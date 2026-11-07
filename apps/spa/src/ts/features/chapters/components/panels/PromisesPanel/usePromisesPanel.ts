import { ref, watch, onMounted, onUnmounted } from 'vue';
import { plotApi } from '@/services/api/plot.api';
import {
  usePromiseFiltering,
  cleanId,
  PROMISE_KINDS,
  PROMISE_STATUSES,
  type ChapterMetaItem
} from './composables/usePromiseFiltering';
import { usePromiseActions } from './composables/usePromiseActions';
import type { PromiseMilestone, RichPlotPromise } from './composables/PromiseActions.model';
import { usePromiseResize } from './composables/usePromiseResize';
import type { PromisesPanelProps } from './PromisesPanel.model';

export type { ChapterMetaItem, PromiseMilestone, RichPlotPromise };
export { PROMISE_KINDS, PROMISE_STATUSES, cleanId };
export type { PromisesPanelProps };

export function usePromisesPanel(
  props: PromisesPanelProps,
  emit: {
    (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
    (e: 'change'): void;
  }
) {
  const promises = ref<RichPlotPromise[]>([]);
  const loading = ref(false);
  const isCollapsed = ref(false);

  const resize = usePromiseResize();

  const filtering = usePromiseFiltering<RichPlotPromise>({
    promises,
    chapterId: () => props.chapterId,
    chapterTitle: () => props.chapterTitle,
    allChapters: () => props.allChapters
  });

  const actions = usePromiseActions({
    props,
    project: props.project,
    chapterId: props.chapterId ?? null,
    currentVolumeId: props.currentVolumeId,
    promises,
    emit
  });

  /** Нормализация для нечёткого сравнения */
  const normalizeChunk = (s: string) =>
    s.replace(/[«»""''.,!?:;—–\u2212-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  /**
   * Извлекает якорь начала из цитаты — берём текст ДО первого разделителя
   * абзацев (— / перенос строки / конец), не более ~25 символов.
   * Это гарантирует, что якорь лежит внутри одного параграфа.
   */
  const extractStartAnchor = (quote: string): string => {
    // Берём текст до первого «—», «–», «\n» или просто первые 25 символов
    const firstBreak = quote.search(/[—–\n]/);
    const raw = firstBreak > 5 ? quote.slice(0, firstBreak) : quote.slice(0, 25);
    return normalizeChunk(raw);
  };

  let syncSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const dirtyPromisesToSave = new Map<string, RichPlotPromise>();

  const scheduleBackendPromiseSync = (p: RichPlotPromise) => {
    if (!p.id) return;
    dirtyPromisesToSave.set(p.id, p);
    if (syncSaveTimer) clearTimeout(syncSaveTimer);
    syncSaveTimer = setTimeout(() => {
      syncSaveTimer = null;
      const items = Array.from(dirtyPromisesToSave.values());
      dirtyPromisesToSave.clear();
      for (const item of items) {
        void actions.updatePromise(item);
      }
    }, 1200);
  };

  /**
   * Синхронизирует поле `quote` и `block_ids` у каждого обещания с актуальным HTML главы.
   *
   * Стратегия (по приоритету):
   *  1. Явный data-block-id в DOM — стабильный якорь.
   *  2. Позиционный диапазон para-N + граничные якоря (начало и конец цитаты) —
   *     корректно расширяет/сдвигает сцену при вставке/удалении строк (Enter / Backspace) внутри сцены.
   */
  const syncQuotesWithManuscript = (persistToBackend = false) => {
    const chapterData = props.chapterData as ({ content?: string } & Record<string, unknown>) | null | undefined;
    const rawContent = chapterData?.content;
    if (!rawContent || typeof rawContent !== 'string') return;
    const html = rawContent.trim();
    if (!html) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const pNodes = Array.from(doc.querySelectorAll('p, blockquote'));
      if (pNodes.length === 0) return;

      const cleanChapId = cleanId(props.chapterId);
      let hasChanges = false;

      for (const p of promises.value) {
        const pChapId = cleanId(p.chapter_id);
        if (!cleanChapId || pChapId !== cleanChapId) continue;

        const currentQuote = p.quote ?? '';
        if (!currentQuote.trim() && (!p.block_ids || p.block_ids.length === 0)) continue;

        // ── Путь 0: Явные data-block-id в DOM (массив блоков сцены) ────────
        if (p.block_ids && p.block_ids.length > 0) {
          const matchedTexts: string[] = [];
          for (const bId of p.block_ids) {
            const cleanBId = bId.replace(/^(text_blocks|blocks):/, '').replace(/[`⟨⟩"']/g, '');
            const shortId = cleanBId.replace(/^blk_[^_]+_/, '');
            const blockEl = doc.querySelector(`[data-block-id="${bId}"], [data-block-id="${cleanBId}"], [data-block-id="${shortId}"], [data-id="${bId}"], [data-id="${cleanBId}"], [data-id="${shortId}"]`);
            if (blockEl && blockEl.textContent?.trim()) {
              matchedTexts.push(blockEl.textContent.trim());
            }
          }
          if (matchedTexts.length > 0) {
            const combinedText = matchedTexts.join('\n');
            if (p.quote !== combinedText) {
              if (!p.title || p.title === p.quote) p.title = combinedText;
              p.quote = combinedText;
              hasChanges = true;
              if (persistToBackend) scheduleBackendPromiseSync(p);
            }
            if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
            continue;
          }
        }

        // ── Путь 1: Явный block_id в DOM ───────────────────────────────────
        if (p.block_id) {
          const rawId = p.block_id;
          const cleanBId = rawId.replace(/^(text_blocks|blocks):/, '').replace(/[`⟨⟩"']/g, '');
          const shortId = cleanBId.replace(/^blk_[^_]+_/, '');
          const blockEl = doc.querySelector(`[data-block-id="${rawId}"], [data-block-id="${cleanBId}"], [data-block-id="${shortId}"], [data-id="${rawId}"], [data-id="${cleanBId}"], [data-id="${shortId}"]`);
          if (blockEl) {
            const newText = blockEl.textContent?.trim() ?? '';
            if (newText && p.quote !== newText) {
              if (!p.title || p.title === p.quote) p.title = newText;
              p.quote = newText;
              hasChanges = true;
              if (persistToBackend) scheduleBackendPromiseSync(p);
            }
            if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
            continue;
          }
        }

        // Извлекаем позиционный диапазон para-N (0-based), если есть
        const paraIndices: number[] = [];
        for (const rawB of p.block_ids ?? (p.block_id ? [p.block_id] : [])) {
          const m = String(rawB).match(/para-(\d+)/i);
          if (m) {
            const idx0 = parseInt(m[1], 10) - 1;
            if (idx0 >= 0 && !paraIndices.includes(idx0)) paraIndices.push(idx0);
          }
        }
        paraIndices.sort((a, b) => a - b);
        const minParaIdx = paraIndices.length > 0 ? paraIndices[0] : -1;
        const maxParaIdx = paraIndices.length > 0 ? paraIndices[paraIndices.length - 1] : -1;
        const expectedSpan = minParaIdx !== -1 && maxParaIdx !== -1 ? Math.max(1, maxParaIdx - minParaIdx + 1) : 1;

        const trimmed = currentQuote.trim();
        const quoteLines = trimmed.split(/[\r\n]+/).map(normalizeChunk).filter((s) => s.length >= 4);
        const isMultiParagraph = expectedSpan > 1 || quoteLines.length > 1 || trimmed.includes('\n');

        // ── Путь 1.5: Прямой поиск цитаты в одиночном параграфе рукописи ───
        if (!isMultiParagraph) {
          const normQuote = normalizeChunk(trimmed);
          let directFoundIdx = -1;
          for (let i = 0; i < pNodes.length; i++) {
            const nodeNorm = normalizeChunk(pNodes[i].textContent ?? '');
            if (!nodeNorm) continue;
            if (nodeNorm.includes(normQuote) || (normQuote.length > 15 && nodeNorm.includes(normQuote.slice(0, 30)))) {
              directFoundIdx = i;
              break;
            }
          }

          if (directFoundIdx !== -1) {
            p.paragraph_index = directFoundIdx + 1;
            if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
            continue;
          }

          // Проверяем наличие текста в теле документа целиком
          const fullDocText = normalizeChunk(doc.body?.textContent ?? '');
          if (normQuote.length >= 8 && fullDocText.includes(normQuote)) {
            if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
            continue;
          }
        }

        // ── Путь 2: Boundary matching (многоабзацные сцены и изменённые абзацы)
        // Если есть несколько строк (\n), берём первую строку; иначе — до первого «—» / первые 25 символов
        const normStart = quoteLines.length > 1
          ? quoteLines[0].slice(0, 45).trim()
          : extractStartAnchor(trimmed);
        const lastBreak = trimmed.search(/[—–\n](?=[^—–\n]*$)/);
        const endRaw = lastBreak >= 0 ? trimmed.slice(lastBreak + 1) : trimmed.slice(-35);
        const normEnd = quoteLines.length > 1
          ? quoteLines[quoteLines.length - 1].slice(-45).trim()
          : normalizeChunk(endRaw.trim());

        let startIdx = -1;
        let endIdx = -1;

        if (normStart.length >= 4) {
          for (let i = 0; i < pNodes.length; i++) {
            const nodeNorm = normalizeChunk(pNodes[i].textContent ?? '');
            if (nodeNorm.length >= 4 && (nodeNorm.includes(normStart) || (nodeNorm.length >= 10 && normStart.includes(nodeNorm)))) {
              startIdx = i;
              break;
            }
          }
        }
        if (startIdx === -1 && minParaIdx >= 0 && minParaIdx < pNodes.length) {
          startIdx = minParaIdx;
        }

        if (startIdx !== -1 && normEnd.length >= 4) {
          const maxSearchIdx = Math.min(
            pNodes.length - 1,
            startIdx + Math.max(expectedSpan, quoteLines.length, 2) + 12
          );
          for (let i = maxSearchIdx; i >= startIdx; i--) {
            const nodeNorm = normalizeChunk(pNodes[i].textContent ?? '');
            if (nodeNorm.length >= 4 && (nodeNorm.includes(normEnd) || (nodeNorm.length >= 10 && normEnd.includes(nodeNorm)))) {
              endIdx = i;
              break;
            }
          }
        }
        if (endIdx === -1 && startIdx !== -1 && expectedSpan > 1) {
          endIdx = Math.min(pNodes.length - 1, startIdx + expectedSpan - 1);
        }

        // Якоря не найдены или диапазон слишком большой → помечаем как orphan
        if (startIdx === -1 || endIdx === -1 || endIdx < startIdx || (endIdx - startIdx) > 30) {
          if (!p.is_orphaned) { p.is_orphaned = true; hasChanges = true; }
          continue;
        }

        const rangeTexts = pNodes
          .slice(startIdx, endIdx + 1)
          .map(n => n.textContent?.trim() ?? '')
          .filter(Boolean);

        if (rangeTexts.length === 0) continue;

        const reconstructed = rangeTexts.join('\n');
        const newBlockIds: string[] = [];
        for (let idx = startIdx; idx <= endIdx; idx++) {
          newBlockIds.push(`para-${idx + 1}`);
        }

        // Мягкий гард: допускаем изменение длины в 10 раз в любую сторону
        const ratio = reconstructed.length / Math.max(1, currentQuote.length);
        if (ratio < 0.1 || ratio > 10) continue;

        const prevBlockIdsKey = (p.block_ids || []).join(',');
        const nextBlockIdsKey = newBlockIds.join(',');

        if (p.quote !== reconstructed || prevBlockIdsKey !== nextBlockIdsKey || p.paragraph_index !== startIdx + 1) {
          if (!p.title || p.title === p.quote) {
            p.title = reconstructed;
          }
          p.quote = reconstructed;
          p.paragraph_index = startIdx + 1;
          p.block_ids = newBlockIds;
          p.block_id = newBlockIds[0] || p.block_id;
          if (p.milestones && p.milestones[0]) {
            p.milestones[0].quote = reconstructed;
            p.milestones[0].order_index = startIdx + 1;
            p.milestones[0].block_id = newBlockIds[0] || p.milestones[0].block_id;
          }
          hasChanges = true;
          if (persistToBackend) scheduleBackendPromiseSync(p);
        }
        // Текст найден — снимаем orphan-флаг
        if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
      }

      if (hasChanges && props.project) {
        try {
          localStorage.setItem(`ww_plot_promises_${props.project}`, JSON.stringify(promises.value));
        } catch (err) {
          console.warn('[usePromisesPanel] Failed to save promises to localStorage:', err);
        }
      }
    } catch (err) {
      console.warn('[usePromisesPanel] DOMParser/querySelector error during quote sync:', err);
    }
  };

  const loadPromises = async () => {
    if (!props.project) return;
    loading.value = true;
    const localKey = `ww_plot_promises_${props.project}`;
    try {
      const rawList = await plotApi.getPlotPromises(props.project);
      const list = Array.isArray(rawList) ? (rawList as unknown as RichPlotPromise[]) : [];
      promises.value = list.map((p) => {
        const milestones = Array.isArray(p.milestones) ? p.milestones : [];
        const plant = milestones.find((m) => m.stage === 'plant') || milestones[0];
        const progressions = milestones.filter((m) => m.stage === 'progression');
        const resolution = milestones.find((m) => m.stage === 'resolution') || null;

        const cleanParent = p.parent_id && p.parent_id !== 'NONE' && p.parent_id !== 'plot_promises:NONE'
          ? p.parent_id
          : null;
        const cleanBlockIds = Array.isArray(p.block_ids)
          ? p.block_ids
              .filter((b): b is string => typeof b === 'string' && b.trim().length > 0 && b !== 'NONE')
              .map((b) => {
                const stripped = b.replace(/^(text_blocks|blocks):/i, '').replace(/[`⟨⟩"']/g, '').trim();
                const pm = stripped.match(/(para-\d+)$/i);
                return pm ? pm[1] : stripped.replace(/^blk_[^_]+_/, '');
              })
          : [];

        return {
          ...p,
          parent_id: cleanParent,
          block_ids: cleanBlockIds,
          chapter_id: p.chapter_id || plant?.chapter_id || '',
          quote: p.quote || plant?.quote || p.title || '',
          paragraph_index: p.paragraph_index || plant?.order_index || 1,
          block_id: p.block_id || plant?.block_id || cleanBlockIds[0] || null,
          progressions: p.progressions || progressions,
          resolution: p.resolution || resolution,
          milestones
        };
      });
      try {
        if (promises.value.length === 0) {
          localStorage.removeItem(localKey);
        } else {
          localStorage.setItem(localKey, JSON.stringify(promises.value));
        }
      } catch (err) {
        console.warn('[usePromisesPanel] Failed to sync promises cache with localStorage:', err);
      }
      syncQuotesWithManuscript();
    } catch (err) {
      console.warn('[usePromisesPanel] Failed to load promises from backend:', err);
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          promises.value = JSON.parse(stored);
          syncQuotesWithManuscript();
        }
      } catch (e) {
        console.warn('[usePromisesPanel] Failed to restore promises from local fallback:', e);
      }
    } finally {
      loading.value = false;
    }
  };

  watch(() => [props.project, props.chapterId], loadPromises);

  // Триггерится каждый раз, когда Tiptap-редактор генерирует новый HTML.
  // Т.к. content теперь явно объявлен в интерфейсе — Vue правильно отслеживает изменения.
  watch(
    () => props.chapterData?.content,
    (newVal, oldVal) => {
      syncQuotesWithManuscript(Boolean(oldVal && newVal !== oldVal));
    },
    { immediate: true }
  );

  const onEditorUpdate = () => { syncQuotesWithManuscript(true); };
  onMounted(() => {
    loadPromises();
    document.addEventListener('ww:editor-content-updated', onEditorUpdate);
  });
  onUnmounted(() => {
    if (syncSaveTimer) {
      clearTimeout(syncSaveTimer);
      syncSaveTimer = null;
    }
    document.removeEventListener('ww:editor-content-updated', onEditorUpdate);
  });

  return {
    syncQuotesWithManuscript,
    isCollapsed,
    promises,
    chapterPromises: filtering.chapterPromises,
    filteredPromises: filtering.filteredPromises,
    loading,
    editingNoteId: actions.editingNoteId,
    noteDraft: actions.noteDraft,
    scopeFilter: filtering.scopeFilter,
    statusFilter: filtering.statusFilter,
    categoryFilter: filtering.categoryFilter,
    loadPromises,
    addPromise: actions.addPromise,
    addNewScene: actions.addNewScene,
    addSubScene: actions.addSubScene,
    updatePromise: actions.updatePromise,
    addMilestone: actions.addMilestone,
    removeMilestone: actions.removeMilestone,
    updateStatus: actions.updateStatus,
    startEditNote: actions.startEditNote,
    saveNote: actions.saveNote,
    cancelEditNote: actions.cancelEditNote,
    removePromise: actions.removePromise,
    locateSource: actions.locateSource,
    getKindInfo: filtering.getKindInfo,
    getChapterTitle: filtering.getChapterTitle,
    isCurrentChapterPromise: filtering.isCurrentChapterPromise,
    promptAttachMilestone: actions.promptAttachMilestone,
    promisesHeight: resize.promisesHeight,
    isResizing: resize.isResizing,
    startVerticalResize: resize.startVerticalResize
  };
}
