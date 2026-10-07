import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as api from '@/services/api.client';
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

export type { ChapterMetaItem, PromiseMilestone, RichPlotPromise };
export { PROMISE_KINDS, PROMISE_STATUSES, cleanId };

export interface PromisesPanelProps {
  project: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  currentVolumeId?: string | null;
  allChapters?: ChapterMetaItem[];
  chapterData?: {
    id?: string | null;
    title?: string | null;
    content?: string | null;
    participants?: unknown;
    timeline_events?: unknown;
    [key: string]: unknown;
  } | null;
}

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
    chapterId: props.chapterId,
    chapterTitle: props.chapterTitle,
    allChapters: props.allChapters
  });

  const actions = usePromiseActions({
    props,
    project: props.project,
    chapterId: props.chapterId,
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

  /**
   * Синхронизирует поле `quote` у каждого обещания с актуальным HTML главы.
   *
   * Стратегия (по приоритету):
   *  1. block_id  — стабильный якорь, всегда побеждает, без ограничений по длине.
   *  2. Boundary  — ищем параграф, содержащий начало цитаты (до первого «—»),
   *                 затем — параграф, содержащий конец.
   */
  const syncQuotesWithManuscript = () => {
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

      const cleanChapId = (props.chapterId ?? '').replace(/^chapters:/, '');
      let hasChanges = false;

      for (const p of promises.value) {
        const pChapId = (p.chapter_id ?? '').replace(/^chapters:/, '');
        if (pChapId !== cleanChapId) continue;

        const currentQuote = p.quote ?? '';
        if (!currentQuote.trim()) continue;

        // ── Путь 1: block_id ──────────────────────────────────────────────
        if (p.block_id) {
          const blockEl = doc.querySelector(`[data-block-id="${p.block_id}"]`);
          if (blockEl) {
            const newText = blockEl.textContent?.trim() ?? '';
            if (newText && p.quote !== newText) {
              p.quote = newText;
              hasChanges = true;
            }
            // Текст найден — снимаем orphan-флаг
            if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
            continue; // block_id нашли → boundary matching не нужен
          }
          // block_id не нашли (параграф удалён) → падаем на boundary matching
        }

        // ── Путь 2: Boundary matching ─────────────────────────────────────
        const trimmed = currentQuote.trim();

        // Якорь начала: текст до первого «—» / первые ~25 символов
        const normStart = extractStartAnchor(trimmed);

        // Якорь конца: последние ~25 символов (после последнего «—»)
        const lastBreak = trimmed.search(/[—–\n](?=[^—–\n]*$)/);
        const endRaw = lastBreak >= 0 ? trimmed.slice(lastBreak + 1) : trimmed.slice(-25);
        const normEnd = normalizeChunk(endRaw.trim());

        // Если якоря слишком короткие — невозможно найти
        if (normStart.length < 4 || normEnd.length < 4) continue;

        let startIdx = -1;
        let endIdx   = -1;

        for (let i = 0; i < pNodes.length; i++) {
          const nodeNorm = normalizeChunk(pNodes[i].textContent ?? '');
          if (startIdx === -1 && nodeNorm.includes(normStart)) {
            startIdx = i;
          }
          if (startIdx !== -1 && nodeNorm.includes(normEnd)) {
            endIdx = i;
            break;
          }
        }

        // Якоря не найдены или диапазон слишком большой → помечаем как orphan
        if (startIdx === -1 || endIdx === -1 || endIdx < startIdx || (endIdx - startIdx) > 20) {
          if (!p.is_orphaned) { p.is_orphaned = true; hasChanges = true; }
          continue;
        }

        const rangeTexts = pNodes
          .slice(startIdx, endIdx + 1)
          .map(n => n.textContent?.trim() ?? '')
          .filter(Boolean);

        if (rangeTexts.length === 0) continue;

        const reconstructed = rangeTexts.join('\n');

        // Мягкий гард: допускаем изменение длины в 10 раз в любую сторону
        const ratio = reconstructed.length / Math.max(1, currentQuote.length);
        if (ratio < 0.1 || ratio > 10) continue;

        if (p.quote !== reconstructed) {
          p.quote = reconstructed;
          p.paragraph_index = startIdx + 1;
          hasChanges = true;
        }
        // Текст найден — снимаем orphan-флаг
        if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
      }

      if (hasChanges && props.project) {
        try {
          localStorage.setItem(`ww_plot_promises_${props.project}`, JSON.stringify(promises.value));
        } catch { /* ignore */ }
      }
    } catch {
      // Swallow DOMParser / querySelector errors
    }
  };

  const loadPromises = async () => {
    if (!props.project) return;
    loading.value = true;
    const localKey = `ww_plot_promises_${props.project}`;
    try {
      const list = await api.getPlotPromises(props.project);
      promises.value = Array.isArray(list) ? (list as unknown as RichPlotPromise[]) : [];
      try {
        if (promises.value.length === 0) {
          localStorage.removeItem(localKey);
        } else {
          localStorage.setItem(localKey, JSON.stringify(promises.value));
        }
      } catch { /* ignore */ }
      syncQuotesWithManuscript();
    } catch (err) {
      console.warn('[usePromisesPanel] Failed to load promises from backend:', err);
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          promises.value = JSON.parse(stored);
          syncQuotesWithManuscript();
        }
      } catch { /* ignore */ }
    } finally {
      loading.value = false;
    }
  };

  watch(() => [props.project, props.chapterId], loadPromises);

  // Триггерится каждый раз, когда Tiptap-редактор генерирует новый HTML.
  // Т.к. content теперь явно объявлен в интерфейсе — Vue правильно отслеживает изменения.
  watch(
    () => props.chapterData?.content,
    syncQuotesWithManuscript,
    { immediate: true }
  );

  const onEditorUpdate = () => { syncQuotesWithManuscript(); };
  onMounted(() => {
    loadPromises();
    document.addEventListener('ww:editor-content-updated', onEditorUpdate);
  });
  onUnmounted(() => {
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
