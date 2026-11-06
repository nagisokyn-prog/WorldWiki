import { watch, nextTick, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/components/panels/PromisesPanel/usePromisesPanel';

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
  paragraphIndex?: number,
  blockIds?: string[]
): HTMLElement[] {
  const topBlocks = Array.from(
    editorDom.querySelectorAll(':scope > p, :scope > blockquote, :scope > h1, :scope > h2, :scope > h3, :scope > div.semantic-paragraph-node, :scope > div')
  ) as HTMLElement[];

  if (topBlocks.length === 0) return [];

  // 0. ПРЯМОЙ И СТАБИЛЬНЫЙ ПОИСК ПО blockIds (не зависит от изменения текста)
  if (blockIds && blockIds.length > 0) {
    const cleanTargetIds = blockIds.map((id) => (id.split(':').pop() || id).trim().toLowerCase());
    const matchedByBlockIds = topBlocks.filter((el, idx) => {
      const bId = (el.getAttribute('data-block-id') || el.getAttribute('data-id') || `para-${idx + 1}`).trim().toLowerCase();
      const cleanBId = bId.split(':').pop() || bId;
      return cleanTargetIds.includes(bId) || cleanTargetIds.includes(cleanBId);
    });

    if (matchedByBlockIds.length > 0) {
      return matchedByBlockIds;
    }
  }

  const cleanString = (s: string) =>
    s
      .replace(/[«»""''„“]/g, '')
      .replace(/[—–−-]/g, ' ')
      .replace(/[.,!?:;…()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const extractText = (el: HTMLElement) => {
    const clone = el.cloneNode(true) as HTMLElement;
    const icons = clone.querySelectorAll('.entity-icon, .chip-icon, .mention-icon, .btn-icon');
    icons.forEach((ic) => ic.remove());
    return cleanString(clone.textContent || '');
  };

  const blockTexts = topBlocks.map((el) => extractText(el));
  const trimmedQuote = (quote || '').trim();

  // 1. Поиск начального блока по blockId (если указан)
  let startIndex = -1;
  if (blockId && blockId.trim()) {
    const safeId = blockId.trim();
    const cleanId = safeId.split(':').pop() || safeId;
    startIndex = topBlocks.findIndex((el) => {
      const bId = el.getAttribute('data-block-id') || el.getAttribute('data-id');
      return bId === safeId || bId === cleanId;
    });
  }

  // 2. Если по blockId не найдено, ищем по началу цитаты
  if (startIndex === -1 && trimmedQuote) {
    const quoteChunks = trimmedQuote.split(/[\r\n]+|[.!?—–]+\s+/).map(cleanString).filter((s) => s.length > 5);
    const startAnchor = quoteChunks[0] || cleanString(trimmedQuote.slice(0, 35));

    if (startAnchor && startAnchor.length >= 4) {
      startIndex = blockTexts.findIndex((text) => text.includes(startAnchor) || startAnchor.includes(text));
    }
  }

  // 3. Fallback: по порядковому номеру абзаца
  if (startIndex === -1 && typeof paragraphIndex === 'number' && paragraphIndex > 0) {
    startIndex = Math.max(0, Math.min(topBlocks.length - 1, paragraphIndex - 1));
  }

  if (startIndex === -1) {
    return [];
  }

  // 4. Определение конца диапазона (endIndex)
  let endIndex = startIndex;

  if (trimmedQuote) {
    const quoteChunks = trimmedQuote.split(/[\r\n]+|[.!?—–]+\s+/).map(cleanString).filter((s) => s.length > 5);
    const endAnchor = quoteChunks[quoteChunks.length - 1] || cleanString(trimmedQuote.slice(-35));

    if (endAnchor && endAnchor.length >= 4) {
      for (let i = topBlocks.length - 1; i >= startIndex; i--) {
        const text = blockTexts[i];
        if (text && (text.includes(endAnchor) || endAnchor.includes(text))) {
          endIndex = i;
          break;
        }
      }
    }

    // Если цитата охватывает несколько абзацев, проверяем последовательное включение
    if (endIndex === startIndex) {
      const normFullQuote = cleanString(trimmedQuote);
      for (let i = startIndex; i < topBlocks.length; i++) {
        const text = blockTexts[i];
        if (!text || text.length < 4) continue;
        if (normFullQuote.includes(text) || quoteChunks.some((c) => c.length > 6 && text.includes(c))) {
          endIndex = i;
        } else if (i > startIndex) {
          break;
        }
      }
    }
  }

  return topBlocks.slice(startIndex, endIndex + 1);
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

      const itemQuote = (item as unknown as { quote?: string }).quote || undefined;
      const itemsToMatch = relevantMilestones.length > 0 ? relevantMilestones : [{
        chapter_id: options.chapterId.value || '',
        order_index: 1,
        block_id: null,
        quote: itemQuote || item.title,
        stage: 'setup' as const
      }];

      // Собираем все абзацы, принадлежащие этому узлу
      const matchedElements: HTMLElement[] = [];
      const itemBlockIds = (item as unknown as { block_ids?: string[] }).block_ids;
      for (const m of itemsToMatch) {
        const mObj = m as unknown as { block_id?: string | null; block_ids?: string[]; quote?: string | null; paragraph_index?: number; order_index?: number | null };
        const pIdx = mObj.paragraph_index ?? (mObj.order_index ? Number(mObj.order_index) : 1);
        const bIds = mObj.block_ids && mObj.block_ids.length > 0 ? mObj.block_ids : itemBlockIds;
        const elements = findSceneElements(editorDom, m.quote || itemQuote || item.title, mObj.block_id || undefined, pIdx, bIds);
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

  const locateScene = (paragraphIndex: number, quote?: string, blockId?: string, blockIds?: string[]) => {
    if (!options.editor.value || (options.editorMode.value !== 'wysiwyg' && options.editorMode.value !== 'split')) {
      return;
    }

    const editorDom = options.editor.value.view.dom;
    if (!editorDom) return;

    const targetElements = findSceneElements(editorDom, quote, blockId, paragraphIndex, blockIds);
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

  let cleanupEditorListener: (() => void) | null = null;

  const attachEditorListeners = (ed?: Editor) => {
    if (cleanupEditorListener) {
      cleanupEditorListener();
      cleanupEditorListener = null;
    }
    if (!ed || typeof ed.on !== 'function') return;

    let animFrameId: number | null = null;
    const onUpdate = () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(() => {
        animFrameId = null;
        renderSceneFrames();
      });
    };

    ed.on('update', onUpdate);

    cleanupEditorListener = () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      if (typeof ed.off === 'function') {
        ed.off('update', onUpdate);
      }
    };
  };

  watch(
    () => options.editor.value,
    (ed) => {
      attachEditorListeners(ed);
      if (ed) {
        nextTick(() => {
          requestAnimationFrame(renderSceneFrames);
        });
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    if (cleanupEditorListener) {
      cleanupEditorListener();
      cleanupEditorListener = null;
    }
  });

  return {
    renderSceneFrames,
    locateScene
  };
}
