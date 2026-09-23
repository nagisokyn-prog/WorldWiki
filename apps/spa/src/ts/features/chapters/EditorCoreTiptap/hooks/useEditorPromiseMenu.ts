import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/PromisesPanel/usePromisesPanel';
import type { PromiseTypeOption } from '../usePromiseContextMenu';

export interface UseEditorPromiseMenuOptions {
  editorMode: Ref<string>;
  editor: Ref<Editor | undefined>;
  markdownTextareaRef: Ref<HTMLTextAreaElement | null>;
  onOpenPromiseCreateModal: (payload: { kind: string; quote: string; paragraph_index: number; block_id?: string | null }) => void;
  onLinkMilestone: (payload: { promiseId: string; stage: 'progression' | 'resolution'; quote: string; paragraph_index: number; block_id?: string | null }) => void;
}

export function useEditorPromiseMenu(options: UseEditorPromiseMenuOptions) {
  const isPromiseMenuOpen = ref(false);
  const promiseMenuPos = ref({ x: 0, y: 0 });
  const selectedPromiseData = ref<{ quote: string; paragraph_index: number; block_id?: string | null }>({
    quote: '',
    paragraph_index: 1,
    block_id: null
  });

  const handleContextMenu = (e: MouseEvent) => {
    let selectedText = '';
    let paragraphIndex = 1;

    if (options.editorMode.value === 'wysiwyg' || options.editorMode.value === 'split') {
      if (options.editor.value) {
        const { selection, doc } = options.editor.value.state;
        if (!selection.empty) {
          selectedText = doc.textBetween(selection.from, selection.to, ' ').trim();

          let blockCount = 0;
          let foundIdx = 1;
          doc.forEach((node, offset) => {
            blockCount++;
            if (selection.from >= offset && selection.from <= offset + node.nodeSize) {
              foundIdx = blockCount;
            }
          });
          paragraphIndex = Math.max(1, foundIdx);
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
        const lines = beforeText.split('\n');
        paragraphIndex = Math.max(1, lines.length);
      }
    }

    if (!selectedText) {
      const winSel = window.getSelection()?.toString().trim();
      if (winSel) {
        selectedText = winSel;
      }
    }

    if (selectedText) {
      e.preventDefault();
      selectedPromiseData.value = {
        quote: selectedText,
        paragraph_index: paragraphIndex,
        block_id: null
      };
      promiseMenuPos.value = { x: e.clientX, y: e.clientY };
      isPromiseMenuOpen.value = true;
    }
  };

  const handlePromiseSelect = (option: PromiseTypeOption) => {
    isPromiseMenuOpen.value = false;
    options.onOpenPromiseCreateModal({
      kind: option.kind,
      quote: selectedPromiseData.value.quote,
      paragraph_index: selectedPromiseData.value.paragraph_index,
      block_id: selectedPromiseData.value.block_id
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
      block_id: selectedPromiseData.value.block_id
    });
  };

  return {
    isPromiseMenuOpen,
    promiseMenuPos,
    selectedPromiseData,
    handleContextMenu,
    handlePromiseSelect,
    handleMilestoneSelect
  };
}
