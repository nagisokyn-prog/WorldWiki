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

  // 0. ПРЯМОЙ ПОИСК ПО ЯВНЫМ DOM-АТРИБУТАМ data-block-id / data-id (если они проставлены в DOM)
  let minParaIdx = -1;
  let maxParaIdx = -1;
  const paraIndices: number[] = [];

  if (blockIds && blockIds.length > 0) {
    const cleanTargetIds = blockIds
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => (id.split(':').pop() || id).replace(/[`⟨⟩"']/g, '').trim().toLowerCase());

    const matchedByExplicitDomAttr = topBlocks.filter((el) => {
      const explicitAttr = el.getAttribute('data-block-id') || el.getAttribute('data-id');
      if (!explicitAttr) return false;
      const bId = explicitAttr.trim().toLowerCase();
      const cleanBId = bId.split(':').pop() || bId;
      return (
        cleanTargetIds.includes(bId) ||
        cleanTargetIds.includes(cleanBId) ||
        cleanTargetIds.some((t) => t.endsWith(`_${cleanBId}`) || t === `blk_${cleanBId}`)
      );
    });

    if (matchedByExplicitDomAttr.length > 0) {
      return matchedByExplicitDomAttr;
    }

    // Извлекаем позиционные индексы para-{N} (0-based) как опорный диапазон
    for (const t of cleanTargetIds) {
      const match = t.match(/para-(\d+)/);
      if (match) {
        const pNum = parseInt(match[1], 10);
        if (pNum >= 1) {
          const idx0 = pNum - 1;
          if (!paraIndices.includes(idx0)) {
            paraIndices.push(idx0);
          }
        }
      }
    }

    if (paraIndices.length > 0) {
      paraIndices.sort((a, b) => a - b);
      minParaIdx = paraIndices[0];
      maxParaIdx = paraIndices[paraIndices.length - 1];
    }
  }

  const trimmedQuote = (quote || '').trim();

  // Если цитата не передана, но есть позиционные para-{N} — возвращаем элементы напрямую по индексам
  if (!trimmedQuote && paraIndices.length > 0) {
    return paraIndices
      .filter((idx0) => idx0 >= 0 && idx0 < topBlocks.length)
      .map((idx0) => topBlocks[idx0]);
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
    const icons = clone.querySelectorAll('.entity-icon, .chip-icon, .mention-icon, .btn-icon, .semantic-tag-badge');
    icons.forEach((ic) => ic.remove());
    return cleanString(clone.textContent || '');
  };

  const blockTexts = topBlocks.map((el) => extractText(el));
  const quoteLines = trimmedQuote
    ? trimmedQuote
        .split(/[\r\n]+/)
        .map(cleanString)
        .filter((s) => s.length >= 4)
    : [];
  const quoteChunks = trimmedQuote
    ? trimmedQuote
        .split(/[\r\n]+|[.!?—–]+\s+/)
        .map(cleanString)
        .filter((s) => s.length > 5)
    : [];

  const expectedSpan = minParaIdx !== -1 && maxParaIdx !== -1 ? Math.max(1, maxParaIdx - minParaIdx + 1) : 0;

  // 1. Поиск начального блока по явному blockId (если указан в DOM)
  let startIndex = -1;
  if (blockId && blockId.trim()) {
    const safeId = blockId.replace(/[`⟨⟩"']/g, '').trim();
    const cleanId = safeId.split(':').pop() || safeId;
    startIndex = topBlocks.findIndex((el) => {
      const bId = el.getAttribute('data-block-id') || el.getAttribute('data-id');
      return Boolean(bId && (bId === safeId || bId === cleanId || safeId.endsWith(`_${bId}`) || cleanId.endsWith(`_${bId}`)));
    });
    if (startIndex === -1 && minParaIdx === -1) {
      const m = cleanId.toLowerCase().match(/para-(\d+)/);
      if (m) {
        minParaIdx = parseInt(m[1], 10) - 1;
      }
    }
  }

  // 2. Если по явному blockId не найдено, ищем по началу цитаты (startAnchor)
  if (startIndex === -1 && trimmedQuote) {
    const firstLine = quoteLines[0] || quoteChunks[0] || cleanString(trimmedQuote.slice(0, 45));
    const startAnchor = firstLine.length > 45 ? firstLine.slice(0, 45).trim() : firstLine;

    if (startAnchor && startAnchor.length >= 4) {
      startIndex = blockTexts.findIndex((text) => {
        if (!text || text.length < 4) return false;
        return text.includes(startAnchor) || (text.length >= 10 && startAnchor.includes(text));
      });
    }
  }

  // 3. Fallback: если первый абзац был отредактирован пользователем, опираемся на minParaIdx или paragraphIndex
  if (startIndex === -1) {
    if (minParaIdx >= 0 && minParaIdx < topBlocks.length) {
      startIndex = minParaIdx;
    } else if (typeof paragraphIndex === 'number' && paragraphIndex > 0) {
      startIndex = Math.max(0, Math.min(topBlocks.length - 1, paragraphIndex - 1));
    }
  }

  if (startIndex === -1) {
    return [];
  }

  // 4. Определение конца диапазона (endIndex)
  let endIndex = startIndex;

  // Многоабзацной сцена считается, если она охватывает >1 блока в blockIds ИЛИ содержит переносы строк (\n)
  const isMultiParagraph = expectedSpan > 1 || quoteLines.length > 1 || trimmedQuote.includes('\n');

  if (isMultiParagraph) {
    const lastLine =
      quoteLines.length > 1
        ? quoteLines[quoteLines.length - 1]
        : quoteChunks.length > 1
          ? quoteChunks[quoteChunks.length - 1]
          : cleanString(trimmedQuote.slice(-45));
    const endAnchor = lastLine.length > 45 ? lastLine.slice(-45).trim() : lastLine;

    // Окно поиска нижней границы сцены (позволяет вставлять новые абзацы через Enter внутри сцены без потери хвоста)
    const maxSearchIdx = Math.min(
      topBlocks.length - 1,
      startIndex + Math.max(expectedSpan, quoteLines.length, 2) + 12
    );

    if (endAnchor && endAnchor.length >= 4) {
      for (let i = maxSearchIdx; i >= startIndex; i--) {
        const text = blockTexts[i];
        if (text && text.length >= 4) {
          if (text.includes(endAnchor) || (text.length >= 10 && endAnchor.includes(text))) {
            endIndex = i;
            break;
          }
        }
      }
    }

    // Если последний абзац сцены не сматчился по тексту (например, пользователь дописал/изменил конец сцены),
    // используем позиционный размер сцены expectedSpan
    if (endIndex === startIndex && expectedSpan > 1) {
      endIndex = Math.min(topBlocks.length - 1, startIndex + expectedSpan - 1);
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
    const existingFrames = editorDom.querySelectorAll('.scene-frame, .narrative-frame, [class*="narrative-embedded-"]');
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
        'narrative-kind-question',
        'narrative-embedded-gun',
        'narrative-embedded-foreshadowing',
        'narrative-embedded-mystery',
        'narrative-embedded-question',
        'narrative-embedded-conflict'
      );
      el.removeAttribute('data-scene-id');
      el.removeAttribute('data-narrative-id');
      el.removeAttribute('data-narrative-kind');
      el.removeAttribute('data-embedded-kind');
    });

    const promises = options.existingPromises.value || [];
    const currentChapterClean = normalizeId(options.chapterId.value);
    if (!currentChapterClean) return;

    // Сортируем: сначала сцены (макро-каркас), затем вложенные единицы (конфликты, ружья, тайны)
    const narrativeItems = promises.filter(p => p && p.id).sort((a, b) => {
      const isMacroA = a.kind === 'scene';
      const isMacroB = b.kind === 'scene';
      if (isMacroA === isMacroB) return 0;
      return isMacroA ? -1 : 1;
    });

    for (const item of narrativeItems) {
      const kind = item.kind || 'scene';
      const itemChap = (item as unknown as { chapter_id?: string }).chapter_id;
      const itemCleanChap = itemChap ? normalizeId(itemChap) : null;
      const itemBlockIds = (item as unknown as { block_ids?: string[] }).block_ids;

      const milestones = item.milestones || [];
      const relevantMilestones = milestones.filter(m => {
        if (!m.chapter_id) return false;
        return normalizeId(m.chapter_id) === currentChapterClean;
      });

      // Проверяем принадлежность сюжетного элемента к текущей главе:
      // 1) Есть вехи, явно привязанные к этой главе
      // 2) Прямой chapter_id совпадает с текущей главой
      // 3) block_ids содержат префикс текущей главы (blk_{chapterId}_...)
      const hasMatchingBlockPrefix = Boolean(
        itemBlockIds && itemBlockIds.some(b => {
          const cleanB = normalizeId(b);
          return cleanB.startsWith(`blk_${currentChapterClean}_`);
        })
      );

      const belongsToCurrentChapter =
        relevantMilestones.length > 0 ||
        (itemCleanChap !== null && itemCleanChap === currentChapterClean) ||
        hasMatchingBlockPrefix;

      if (!belongsToCurrentChapter) {
        continue;
      }

      const itemQuote = (item as unknown as { quote?: string }).quote || undefined;
      // Если есть вехи для текущей главы - используем их.
      // Если вех нет, но элемент принадлежит этой главе (свежесоздан) - берем его данные
      // БЕЗ принудительного order_index: 1 (чтобы не проецировать его на 1-й абзац главы).
      const itemsToMatch = relevantMilestones.length > 0 ? relevantMilestones : [{
        chapter_id: options.chapterId.value || '',
        order_index: null,
        block_id: null,
        quote: itemQuote || item.title,
        stage: 'setup' as const
      }];

      // Собираем все абзацы, принадлежащие этому узлу
      const matchedElements: HTMLElement[] = [];
      for (const m of itemsToMatch) {
        const mObj = m as unknown as { block_id?: string | null; block_ids?: string[]; quote?: string | null; paragraph_index?: number; order_index?: number | null };
        const pIdx = mObj.paragraph_index ?? (mObj.order_index ? Number(mObj.order_index) : undefined);
        const bIds = mObj.block_ids && mObj.block_ids.length > 0 ? mObj.block_ids : (itemsToMatch.length === 1 ? itemBlockIds : undefined);
        const quoteToUse = itemsToMatch.length === 1 ? (itemQuote || m.quote || item.title) : (m.quote || itemQuote || item.title);
        const elements = findSceneElements(editorDom, quoteToUse, mObj.block_id || undefined, pIdx, bIds);
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
      const isMicroItem = kind !== 'scene';

      matchedElements.forEach((el, index) => {
        const alreadyInScene = el.classList.contains('scene-frame');

        if (alreadyInScene && isMicroItem) {
          // Микро-единица (ружьё, тайна и т.д.) внутри сцены: не разрываем каркас сцены!
          el.classList.add(`narrative-embedded-${kind}`);
          el.setAttribute('data-embedded-kind', kind);
          return;
        }

        el.classList.add('narrative-frame', `narrative-kind-${kind}`);
        if (kind === 'scene') {
          el.classList.add('scene-frame');
        }
        el.setAttribute('data-narrative-id', item.id || '');
        el.setAttribute('data-narrative-kind', kind);
        el.setAttribute('data-scene-id', item.id || '');

        if (count === 1) {
          el.classList.remove('narrative-frame-middle');
          el.classList.add('narrative-frame-single');
        } else if (index === 0) {
          el.classList.remove('narrative-frame-middle');
          el.classList.add('narrative-frame-first');
        } else if (index === count - 1) {
          el.classList.remove('narrative-frame-middle');
          el.classList.add('narrative-frame-last');
        } else {
          // Устанавливаем middle только если на элементе ещё нет явных граничных классов
          if (!el.classList.contains('narrative-frame-first') && !el.classList.contains('narrative-frame-last') && !el.classList.contains('narrative-frame-single')) {
            el.classList.add('narrative-frame-middle');
          }
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
    }
    firstTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
