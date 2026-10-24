import { watch, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/PromisesPanel/usePromisesPanel';

export interface UseEditorSceneFramesOptions {
  editor: Ref<Editor | undefined>;
  existingPromises: Ref<(PlotPromise | RichPlotPromise)[] | undefined>;
  chapterId: Ref<string | null | undefined>;
  editorMode: Ref<string>;
}

export function findSceneElements(
  editorDom: HTMLElement,
  quote?: string,
  blockId?: string,
  paragraphIndex?: number
): HTMLElement[] {
  const targetElements: HTMLElement[] = [];

  // 1. Поиск по blockId (если указан)
  if (blockId && blockId.trim()) {
    const safeId = blockId.trim();
    try {
      const el = editorDom.querySelector(`[data-block-id="${safeId}"], [data-id="${safeId}"]`) as HTMLElement | null;
      if (el) {
        targetElements.push(el);
      }
    } catch (err) {
      console.warn('[useEditorSceneFrames] Failed to query block selector for ID:', safeId, err);
    }
  }

  // 2. Поиск по цитате (поддержка многострочных сцен, диалогов, тире и кавычек)
  if (targetElements.length === 0 && quote && quote.trim()) {
    const cleanString = (s: string) => s.replace(/[«»""'']/g, '').replace(/[—–−-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const normQuote = cleanString(quote);

    const quotePhrases = quote
      .split(/[\r\n]+|[.!?—–]+\s+/)
      .map(cleanString)
      .filter(p => p.length > 5);

    const topBlocks = Array.from(editorDom.querySelectorAll(':scope > *, .semantic-paragraph-node, p, blockquote, h1, h2, h3')) as HTMLElement[];
    const uniqueTopBlocks = Array.from(new Set(topBlocks));

    for (const el of uniqueTopBlocks) {
      const elText = cleanString(el.textContent || '');
      if (!elText || elText.length < 3) continue;

      const isExactMatch = normQuote.length > 5 && (normQuote.includes(elText) || elText.includes(normQuote));
      const isPhraseMatch = quotePhrases.some(phrase => phrase.length > 5 && (elText.includes(phrase) || phrase.includes(elText)));

      if (isExactMatch || isPhraseMatch) {
        if (!targetElements.includes(el)) {
          targetElements.push(el);
        }
      }
    }
  }

  // 3. Fallback: по порядковому номеру абзаца
  if (targetElements.length === 0 && typeof paragraphIndex === 'number' && paragraphIndex > 0) {
    const topBlocks = Array.from(editorDom.children) as HTMLElement[];
    if (topBlocks.length > 0) {
      const idx = Math.max(0, Math.min(topBlocks.length - 1, paragraphIndex - 1));
      const el = topBlocks[idx] || null;
      if (el) targetElements.push(el);
    }
  }

  return targetElements;
}

export function useEditorSceneFrames(options: UseEditorSceneFramesOptions) {
  const normalizeId = (id?: string | null) => (id || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';

  const renderSceneFrames = () => {
    if (!options.editor.value || (options.editorMode.value !== 'wysiwyg' && options.editorMode.value !== 'split')) {
      return;
    }

    const editorDom = options.editor.value.view.dom;
    if (!editorDom) return;

    // Сброс старых рамок
    const existingFrames = editorDom.querySelectorAll('.scene-frame, .narrative-frame');
    existingFrames.forEach(el => {
      el.classList.remove(
        'scene-frame',
        'narrative-frame',
        'narrative-frame-first',
        'narrative-frame-middle',
        'narrative-frame-last',
        'narrative-frame-single',
        'narrative-kind-scene',
        'narrative-kind-conflict',
        'narrative-kind-gun',
        'narrative-kind-foreshadowing',
        'narrative-kind-mystery',
        'narrative-kind-question'
      );
      el.removeAttribute('data-scene-id');
      el.removeAttribute('data-narrative-id');
      el.removeAttribute('data-narrative-kind');
    });

    const promises = options.existingPromises.value || [];
    const currentChapterClean = normalizeId(options.chapterId.value);

    // Обрабатываем все сюжетные единицы: сцены, конфликты, чеховские ружья, тайны и т.д.
    const narrativeItems = promises.filter(p => p && p.id);

    for (const item of narrativeItems) {
      const kind = item.kind || 'scene';
      const milestones = item.milestones || [];
      const relevantMilestones = milestones.filter(m => {
        if (!m.chapter_id || !currentChapterClean) return true;
        return normalizeId(m.chapter_id) === currentChapterClean;
      });

      const itemsToMatch = relevantMilestones.length > 0 ? relevantMilestones : [{
        chapter_id: options.chapterId.value || '',
        order_index: 1,
        block_id: null,
        quote: item.title,
        stage: 'setup' as const
      }];

      // Собираем все абзацы, принадлежащие этому узлу
      const matchedElements: HTMLElement[] = [];
      for (const m of itemsToMatch) {
        const mObj = m as unknown as { block_id?: string | null; quote?: string | null; paragraph_index?: number; order_index?: number | null };
        const pIdx = mObj.paragraph_index ?? (mObj.order_index ? Number(mObj.order_index) : 1);
        const elements = findSceneElements(editorDom, m.quote || item.title, mObj.block_id || undefined, pIdx);
        for (const el of elements) {
          if (!matchedElements.includes(el)) {
            matchedElements.push(el);
          }
        }
      }

      if (matchedElements.length === 0) continue;

      // Упорядочиваем элементы по их положению в DOM-дереве редактора
      matchedElements.sort((a, b) => {
        if (a === b) return 0;
        return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

      const count = matchedElements.length;
      matchedElements.forEach((el, index) => {
        el.classList.add('narrative-frame', `narrative-kind-${kind}`);
        if (kind === 'scene') {
          el.classList.add('scene-frame');
        }
        el.setAttribute('data-narrative-id', item.id || '');
        el.setAttribute('data-narrative-kind', kind);
        el.setAttribute('data-scene-id', item.id || '');

        if (count === 1) {
          el.classList.add('narrative-frame-single');
        } else if (index === 0) {
          el.classList.add('narrative-frame-first');
        } else if (index === count - 1) {
          el.classList.add('narrative-frame-last');
        } else {
          el.classList.add('narrative-frame-middle');
        }
      });
    }
  };

  const locateScene = (paragraphIndex: number, quote?: string, blockId?: string) => {
    if (!options.editor.value || (options.editorMode.value !== 'wysiwyg' && options.editorMode.value !== 'split')) {
      return;
    }

    const editorDom = options.editor.value.view.dom;
    if (!editorDom) return;

    const targetElements = findSceneElements(editorDom, quote, blockId, paragraphIndex);
    if (targetElements.length === 0) return;

    const firstTarget = targetElements[0];
    const wrapper = (editorDom.closest('.editor-wrapper') || editorDom.parentElement) as HTMLElement | null;
    if (wrapper && wrapper.scrollHeight > wrapper.clientHeight) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const targetRect = firstTarget.getBoundingClientRect();
      const offsetTop = targetRect.top - wrapperRect.top + wrapper.scrollTop;
      wrapper.scrollTo({
        top: Math.max(0, offsetTop - wrapper.clientHeight / 2 + targetRect.height / 2),
        behavior: 'smooth'
      });
    } else {
      firstTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Снимаем выделение с других и подсвечиваем эту сцену
    const prevFrames = editorDom.querySelectorAll('.scene-selected-frame');
    prevFrames.forEach(f => f.classList.remove('scene-selected-frame'));

    for (const el of targetElements) {
      el.classList.remove('promise-highlight-target');
      el.classList.add('scene-selected-frame');
    }

    requestAnimationFrame(() => {
      for (const el of targetElements) {
        el.classList.add('promise-highlight-target');
        setTimeout(() => {
          el.classList.remove('promise-highlight-target');
        }, 3000);
      }
    });
  };

  // Следим за изменениями списка обещаний/сцен
  watch(
    () => options.existingPromises.value,
    () => {
      nextTick(() => {
        requestAnimationFrame(renderSceneFrames);
      });
    },
    { deep: true, immediate: true }
  );

  // Следим за загрузкой/сменой главы
  watch(
    () => options.chapterId.value,
    () => {
      nextTick(() => {
        requestAnimationFrame(renderSceneFrames);
      });
    }
  );

  return {
    renderSceneFrames,
    locateScene
  };
}
