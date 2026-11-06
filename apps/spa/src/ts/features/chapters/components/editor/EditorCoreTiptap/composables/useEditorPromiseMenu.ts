import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/components/panels/PromisesPanel/usePromisesPanel';
import type { PromiseTypeOption } from '../usePromiseContextMenu';

export interface UseEditorPromiseMenuOptions {
  editorMode: Ref<string>;
  editor: Ref<Editor | undefined>;
  markdownTextareaRef: Ref<HTMLTextAreaElement | null>;
  onOpenPromiseCreateModal: (payload: { kind: string; quote: string; paragraph_index: number; block_id?: string | null; block_ids?: string[] }) => void;
  onLinkMilestone: (payload: { promiseId: string; stage: 'progression' | 'resolution'; quote: string; paragraph_index: number; block_id?: string | null; block_ids?: string[] }) => void;
  onLinkSubScene?: (payload: { parentPromiseId: string; quote: string; paragraph_index: number; block_id?: string | null; block_ids?: string[] }) => void;
}

export function useEditorPromiseMenu(options: UseEditorPromiseMenuOptions) {
  const isPromiseMenuOpen = ref(false);
  const promiseMenuPos = ref({ x: 0, y: 0 });
  const selectedPromiseData = ref<{ quote: string; paragraph_index: number; block_id?: string | null; block_ids?: string[] }>({
    quote: '',
    paragraph_index: 1,
    block_id: null,
    block_ids: []
  });

  const handleContextMenu = (e: MouseEvent) => {
    let selectedText = '';
    let paragraphIndex = 1;
    let blockId: string | null = null;
    let blockIds: string[] = [];

    if (options.editorMode.value === 'wysiwyg' || options.editorMode.value === 'split') {
      if (options.editor.value) {
        const { selection, doc } = options.editor.value.state;
        if (!selection.empty) {
          selectedText = doc.textBetween(selection.from, selection.to, ' ').trim();

          let blockCount = 0;
          let foundIdx = 1;
          const collectedBlockIds: string[] = [];
          doc.forEach((node, offset) => {
            blockCount++;
            const nodeEnd = offset + node.nodeSize;
            if (selection.to > offset && selection.from < nodeEnd) {
              const attrId = (node.attrs && (node.attrs.block_id || node.attrs.id)) as string | undefined;
              const bId = attrId || `para-${blockCount}`;
              collectedBlockIds.push(bId);
              if (collectedBlockIds.length === 1) {
                foundIdx = blockCount;
                blockId = bId;
              }
            }
          });
          paragraphIndex = Math.max(1, foundIdx);
          blockIds = collectedBlockIds;
        }
      }
    }

    if (!selectedText && options.markdownTextareaRef.value) {
      const ta = options.markdownTextareaRef.value;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      if (start !== end) {
        selectedText = ta.value.substring(start, end).trim();
        const beforeText = ta.value.substring(0, start);
        const selectedBlock = ta.value.substring(start, end);
        const startLine = beforeText.split('\n').length;
        const lineSpan = Math.max(1, selectedBlock.split('\n').length);
        paragraphIndex = Math.max(1, startLine);
        const mBlockIds: string[] = [];
        for (let l = 0; l < lineSpan; l++) {
          mBlockIds.push(`para-${startLine + l}`);
        }
        blockId = `para-${paragraphIndex}`;
        blockIds = mBlockIds;
      }
    }

    if (!selectedText) {
      const winSel = window.getSelection()?.toString().trim();
      if (winSel) {
        selectedText = winSel;
      }
    }

    if (!selectedText && (options.editorMode.value === 'wysiwyg' || options.editorMode.value === 'split')) {
      const view = options.editor.value?.view;
      if (view) {
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (pos) {
          const $pos = view.state.doc.resolve(pos.pos);
          const parentNode = $pos.parent;
          if (parentNode && parentNode.textContent) {
            selectedText = parentNode.textContent.trim().substring(0, 140);
            let count = 0;
            view.state.doc.forEach((node, offset) => {
              count++;
              if (pos.pos >= offset && pos.pos <= offset + node.nodeSize) {
                paragraphIndex = count;
                const attrId = (node.attrs && (node.attrs.block_id || node.attrs.id)) as string | undefined;
                blockId = attrId || `para-${count}`;
                blockIds = [blockId];
              }
            });
          }
        }
      }
    }

    if (!selectedText && options.markdownTextareaRef.value) {
      const ta = options.markdownTextareaRef.value;
      const lines = ta.value.split('\n');
      const curLine = lines[paragraphIndex - 1] || lines[0] || '';
      if (curLine.trim()) {
        selectedText = curLine.trim().substring(0, 140);
        blockIds = [`para-${paragraphIndex}`];
      }
    }

    if (!selectedText) {
      selectedText = 'Сцена';
    }

    if (blockIds.length === 0) {
      blockIds = [blockId || `para-${paragraphIndex}`];
    }

    e.preventDefault();
    selectedPromiseData.value = {
      quote: selectedText,
      paragraph_index: paragraphIndex,
      block_id: blockId || `para-${paragraphIndex}`,
      block_ids: blockIds
    };
    promiseMenuPos.value = { x: e.clientX, y: e.clientY };
    isPromiseMenuOpen.value = true;
  };

  const handlePromiseSelect = (option: PromiseTypeOption) => {
    isPromiseMenuOpen.value = false;
    options.onOpenPromiseCreateModal({
      kind: option.kind,
      quote: selectedPromiseData.value.quote,
      paragraph_index: selectedPromiseData.value.paragraph_index,
      block_id: selectedPromiseData.value.block_id,
      block_ids: selectedPromiseData.value.block_ids
    });
  };

  const handleMilestoneSelect = (payload: { promise: PlotPromise | RichPlotPromise; stage: 'progression' | 'resolution' }) => {
    isPromiseMenuOpen.value = false;
    if (!payload.promise.id) return;
    options.onLinkMilestone({
      promiseId: payload.promise.id,
      stage: payload.stage,
      quote: selectedPromiseData.value.quote,
      paragraph_index: selectedPromiseData.value.paragraph_index,
      block_id: selectedPromiseData.value.block_id,
      block_ids: selectedPromiseData.value.block_ids
    });
  };

  const handleSubSceneSelect = (payload: { promise: PlotPromise | RichPlotPromise }) => {
    isPromiseMenuOpen.value = false;
    if (!payload.promise.id) return;
    options.onLinkSubScene?.({
      parentPromiseId: payload.promise.id,
      quote: selectedPromiseData.value.quote,
      paragraph_index: selectedPromiseData.value.paragraph_index,
      block_id: selectedPromiseData.value.block_id,
      block_ids: selectedPromiseData.value.block_ids
    });
  };

  return {
    isPromiseMenuOpen,
    promiseMenuPos,
    selectedPromiseData,
    handleContextMenu,
    handlePromiseSelect,
    handleMilestoneSelect,
    handleSubSceneSelect
  };
}
