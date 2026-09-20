import { ref } from 'vue';
import type { ParagraphFormatData, PageSize, WordDocumentDTO } from '@worldwiki/word-vibe';
import type { Editor } from '@tiptap/vue-3';

export interface UseEditorWordBridgeOptions {
  editor: { value: Editor | undefined };
  emit: (event: string, ...args: unknown[]) => void;
  syncMarkdownFromEditor: () => void;
  updateStats: () => void;
}

export function useEditorWordBridge(options: UseEditorWordBridgeOptions) {
  const isParagraphModalOpen = ref(false);
  const isCurrentPageLandscape = ref(false);
  const currentPageSize = ref<PageSize>('A4');

  const onWordDocumentUpdate = (_doc: WordDocumentDTO) => {
    // Synchronization with reactive AST tree
  };

  const onWordContentUpdate = (html: string) => {
    options.emit('update:content', html);
    options.emit('change');
    if (options.editor.value) {
      options.editor.value.commands.setContent(html);
      options.updateStats();
      options.syncMarkdownFromEditor();
    }
  };

  const onWordChange = () => {
    options.emit('change');
  };

  const handleParagraphFormatApply = (format: ParagraphFormatData) => {
    if (!options.editor.value) return;
    const { commands } = options.editor.value;
    if (format.firstLineType === 'indent') {
      commands.setParagraphIndent(format.firstLineCm);
    } else {
      commands.setParagraphIndent(0);
    }
    commands.setParagraphLeftMargin(format.leftIndentCm);
    commands.setParagraphRightMargin(format.rightIndentCm);
    commands.setParagraphLineHeight(format.lineHeight);
    isParagraphModalOpen.value = false;
  };

  return {
    isParagraphModalOpen,
    isCurrentPageLandscape,
    currentPageSize,
    onWordDocumentUpdate,
    onWordContentUpdate,
    onWordChange,
    handleParagraphFormatApply
  };
}
