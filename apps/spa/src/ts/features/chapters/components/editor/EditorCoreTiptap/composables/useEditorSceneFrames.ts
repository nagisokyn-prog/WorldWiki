import { watch, nextTick, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import { Decoration } from '@tiptap/pm/view';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/components/panels/PromisesPanel/usePromisesPanel';
import { findSceneElements } from './sceneElementsFinder';
import { findNarrativeBlocksInDoc } from './narrativeDocResolver';
import { narrativeHighlightPluginKey } from '../extensions/NarrativeFramesExtension';
import {
  isProseMirrorReady,
  getRelevantChapterItems,
  renderDecorationsInProseMirror,
  renderFramesDomFallback,
  scrollTargetIntoView
} from './narrativeFramesRenderer';

export { findSceneElements, findNarrativeBlocksInDoc };

export interface UseEditorSceneFramesOptions {
  editor: Ref<Editor | undefined>;
  existingPromises: Ref<(PlotPromise | RichPlotPromise)[] | undefined>;
  chapterId: Ref<string | null | undefined>;
  editorMode: Ref<string>;
}

export function useEditorSceneFrames(options: UseEditorSceneFramesOptions) {
  let highlightTimerId: ReturnType<typeof setTimeout> | null = null;

  const renderSceneFrames = () => {
    const ed = options.editor.value;
    if (!ed || ed.isDestroyed || (options.editorMode.value !== 'wysiwyg' && options.editorMode.value !== 'split')) {
      return;
    }

    const items = getRelevantChapterItems(options.existingPromises.value, options.chapterId.value);

    if (isProseMirrorReady(ed)) {
      renderDecorationsInProseMirror(ed, items);
      return;
    }

    try {
      const editorDom = ed.view?.dom;
      if (editorDom) {
        renderFramesDomFallback(editorDom, items);
      }
    } catch (err) {
      console.debug('[useEditorSceneFrames] Editor view unavailable during render:', err);
    }
  };

  const locateScene = (paragraphIndex: number, quote?: string, blockId?: string, blockIds?: string[]) => {
    const ed = options.editor.value;
    if (!ed || ed.isDestroyed || (options.editorMode.value !== 'wysiwyg' && options.editorMode.value !== 'split')) {
      return;
    }

    let editorDom: HTMLElement | undefined;
    try {
      editorDom = ed.view?.dom;
    } catch (err) {
      console.debug('[useEditorSceneFrames] Editor view unavailable during locate:', err);
      return;
    }
    if (!editorDom) return;

    if (isProseMirrorReady(ed)) {
      const view = ed.view;
      const pmState = view.state;
      if (narrativeHighlightPluginKey.get(pmState)) {
        const blocks = findNarrativeBlocksInDoc(pmState.doc, quote, blockId, paragraphIndex, blockIds);
        if (blocks.length === 0) return;

        const firstDom = view.nodeDOM(blocks[0].pos) as HTMLElement | null;
        if (firstDom) scrollTargetIntoView(editorDom, firstDom);

        const selectedDecos = blocks.map(b =>
          Decoration.node(b.pos, b.pos + b.node.nodeSize, { class: 'scene-selected-frame' })
        );
        view.dispatch(
          pmState.tr.setMeta(narrativeHighlightPluginKey, selectedDecos).setMeta('addToHistory', false)
        );

        if (highlightTimerId !== null) clearTimeout(highlightTimerId);
        requestAnimationFrame(() => {
          const curEd = options.editor.value;
          if (!curEd || !isProseMirrorReady(curEd)) return;
          const curView = curEd.view;
          if (!narrativeHighlightPluginKey.get(curView.state)) return;
          const pulseDecos = blocks.map(b =>
            Decoration.node(b.pos, b.pos + b.node.nodeSize, { class: 'scene-selected-frame promise-highlight-target' })
          );
          curView.dispatch(
            curView.state.tr.setMeta(narrativeHighlightPluginKey, pulseDecos).setMeta('addToHistory', false)
          );
          highlightTimerId = setTimeout(() => {
            highlightTimerId = null;
            const activeEd = options.editor.value;
            if (!activeEd || !isProseMirrorReady(activeEd)) return;
            const actView = activeEd.view;
            if (!narrativeHighlightPluginKey.get(actView.state)) return;
            actView.dispatch(
              actView.state.tr.setMeta(narrativeHighlightPluginKey, selectedDecos).setMeta('addToHistory', false)
            );
          }, 3000);
        });
        return;
      }
    }

    // Фоллбэк для unit-тестов с лёгким DOM-моком без ProseMirror state
    const targetElements = findSceneElements(editorDom, quote, blockId, paragraphIndex, blockIds);
    if (targetElements.length === 0) return;

    scrollTargetIntoView(editorDom, targetElements[0]);

    const prevFrames = editorDom.querySelectorAll('.scene-selected-frame');
    prevFrames.forEach(f => f.classList.remove('scene-selected-frame'));

    for (const el of targetElements) {
      el.classList.remove('promise-highlight-target');
      el.classList.add('scene-selected-frame');
    }

    requestAnimationFrame(() => {
      for (const el of targetElements) {
        el.classList.add('promise-highlight-target');
        setTimeout(() => { el.classList.remove('promise-highlight-target'); }, 3000);
      }
    });
  };

  watch(
    () => options.existingPromises.value,
    () => { nextTick(() => { requestAnimationFrame(renderSceneFrames); }); },
    { deep: true, immediate: true }
  );

  watch(
    () => options.chapterId.value,
    () => { nextTick(() => { requestAnimationFrame(renderSceneFrames); }); }
  );

  let cleanupEditorListener: (() => void) | null = null;

  const attachEditorListeners = (ed?: Editor) => {
    if (cleanupEditorListener) {
      cleanupEditorListener();
      cleanupEditorListener = null;
    }
    if (!ed || typeof ed.on !== 'function') return;

    let animFrameId: number | null = null;
    const scheduleRender = () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(() => {
        animFrameId = null;
        renderSceneFrames();
      });
    };

    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) {
        scheduleRender();
      }
    };

    ed.on('update', scheduleRender);
    ed.on('transaction', onTransaction);

    cleanupEditorListener = () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      if (typeof ed.off === 'function') {
        ed.off('update', scheduleRender);
        ed.off('transaction', onTransaction);
      }
    };
  };

  watch(
    () => options.editor.value,
    (ed) => {
      attachEditorListeners(ed);
      if (ed) nextTick(() => { requestAnimationFrame(renderSceneFrames); });
    },
    { immediate: true }
  );

  onUnmounted(() => {
    if (highlightTimerId !== null) {
      clearTimeout(highlightTimerId);
      highlightTimerId = null;
    }
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
