import type { Ref } from 'vue';
import { cleanId } from './usePromiseFiltering';
import type { RichPlotPromise } from './PromiseActions.model';
import type { PromisesPanelProps } from '../PromisesPanel.model';

/** Нормализация для нечёткого сравнения */
const normalizeChunk = (s: string) =>
  s.replace(/[«»""''.,!?:;—–\u2212-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Извлекает якорь начала из цитаты — берём текст ДО первого разделителя
 * абзацев (— / перенос строки / конец), не более ~25 символов.
 */
const extractStartAnchor = (quote: string): string => {
  const firstBreak = quote.search(/[—–\n]/);
  const raw = firstBreak > 5 ? quote.slice(0, firstBreak) : quote.slice(0, 25);
  return normalizeChunk(raw);
};

export function createPromiseQuoteSync(options: {
  props: PromisesPanelProps;
  promises: Ref<RichPlotPromise[]>;
  onUpdatePromise: (item: RichPlotPromise) => Promise<void>;
}) {
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
        void options.onUpdatePromise(item);
      }
    }, 1200);
  };

  const cleanup = () => {
    if (syncSaveTimer) {
      clearTimeout(syncSaveTimer);
      syncSaveTimer = null;
    }
  };

  const syncQuotesWithManuscript = (persistToBackend = false) => {
    const chapterData = options.props.chapterData as ({ content?: string } & Record<string, unknown>) | null | undefined;
    const rawContent = chapterData?.content;
    if (!rawContent || typeof rawContent !== 'string') return;
    const html = rawContent.trim();
    if (!html) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const pNodes = Array.from(doc.querySelectorAll('p, blockquote'));
      if (pNodes.length === 0) return;

      const cleanChapId = cleanId(options.props.chapterId);
      let hasChanges = false;

      for (const p of options.promises.value) {
        const pChapId = cleanId(p.chapter_id);
        if (!cleanChapId || pChapId !== cleanChapId) continue;

        const currentQuote = p.quote ?? '';
        if (!currentQuote.trim() && (!p.block_ids || p.block_ids.length === 0)) continue;

        // Путь 0: Явные data-block-id в DOM (массив блоков сцены)
        if (p.block_ids && p.block_ids.length > 0) {
          const matchedTexts: string[] = [];
          for (const bId of p.block_ids) {
            const cleanBId = bId.replace(/^(text_blocks|blocks):/, '').replace(/[`⟨⟩"']/g, '');
            const shortId = cleanBId.replace(/^blk_[^_]+_/, '');
            const blockEl = doc.querySelector(
              `[data-block-id="${bId}"], [data-block-id="${cleanBId}"], [data-block-id="${shortId}"], [data-id="${bId}"], [data-id="${cleanBId}"], [data-id="${shortId}"]`
            );
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

        // Путь 1: Явный block_id в DOM
        if (p.block_id) {
          const rawId = p.block_id;
          const cleanBId = rawId.replace(/^(text_blocks|blocks):/, '').replace(/[`⟨⟩"']/g, '');
          const shortId = cleanBId.replace(/^blk_[^_]+_/, '');
          const blockEl = doc.querySelector(
            `[data-block-id="${rawId}"], [data-block-id="${cleanBId}"], [data-block-id="${shortId}"], [data-id="${rawId}"], [data-id="${cleanBId}"], [data-id="${shortId}"]`
          );
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

        // Путь 1.5: Прямой поиск цитаты в одиночном параграфе рукописи
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
          const fullDocText = normalizeChunk(doc.body?.textContent ?? '');
          if (normQuote.length >= 8 && fullDocText.includes(normQuote)) {
            if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
            continue;
          }
        }

        // Путь 2: Boundary matching (многоабзацные сцены и изменённые абзацы)
        const normStart = quoteLines.length > 1 ? quoteLines[0].slice(0, 45).trim() : extractStartAnchor(trimmed);
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
        if (startIdx === -1 && minParaIdx >= 0 && minParaIdx < pNodes.length) startIdx = minParaIdx;

        if (startIdx !== -1 && normEnd.length >= 4) {
          const maxSearchIdx = Math.min(pNodes.length - 1, startIdx + Math.max(expectedSpan, quoteLines.length, 2) + 12);
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

        if (startIdx === -1 || endIdx === -1 || endIdx < startIdx || endIdx - startIdx > 30) {
          if (!p.is_orphaned) { p.is_orphaned = true; hasChanges = true; }
          continue;
        }

        const rangeTexts = pNodes.slice(startIdx, endIdx + 1).map((n) => n.textContent?.trim() ?? '').filter(Boolean);
        if (rangeTexts.length === 0) continue;

        const reconstructed = rangeTexts.join('\n');
        const newBlockIds: string[] = [];
        for (let idx = startIdx; idx <= endIdx; idx++) newBlockIds.push(`para-${idx + 1}`);

        const ratio = reconstructed.length / Math.max(1, currentQuote.length);
        if (ratio < 0.1 || ratio > 10) continue;

        if (p.quote !== reconstructed || (p.block_ids || []).join(',') !== newBlockIds.join(',') || p.paragraph_index !== startIdx + 1) {
          if (!p.title || p.title === p.quote) p.title = reconstructed;
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
        if (p.is_orphaned) { p.is_orphaned = false; hasChanges = true; }
      }

      if (hasChanges && options.props.project) {
        try {
          localStorage.setItem(`ww_plot_promises_${options.props.project}`, JSON.stringify(options.promises.value));
        } catch (err) {
          console.warn('[usePromisesPanel] Failed to save promises to localStorage:', err);
        }
      }
    } catch (err) {
      console.warn('[usePromisesPanel] DOMParser/querySelector error during quote sync:', err);
    }
  };

  return { syncQuotesWithManuscript, cleanup };
}

