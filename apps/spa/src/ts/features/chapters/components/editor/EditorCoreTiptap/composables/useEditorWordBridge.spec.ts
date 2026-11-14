import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import { useEditorWordBridge } from './useEditorWordBridge';
import type { WordDocumentDTO } from '../components/EditorBody/EditorBody.model';
import type { ParagraphFormatData } from '../components/EditorModals/EditorModals.model';

describe('useEditorWordBridge', () => {
  const emit = vi.fn();
  const syncMarkdownFromEditor = vi.fn();
  const updateStats = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockEditor() {
    return {
      commands: {
        setContent: vi.fn(),
        setParagraphIndent: vi.fn(),
        setParagraphLeftMargin: vi.fn(),
        setParagraphRightMargin: vi.fn(),
        setParagraphLineHeight: vi.fn()
      }
    } as unknown as Editor;
  }

  it('handles word document and content updates with and without active editor', () => {
    const editor = ref<Editor | undefined>(undefined);
    const bridge = useEditorWordBridge({
      editor,
      emit,
      syncMarkdownFromEditor,
      updateStats
    });

    expect(bridge.isParagraphModalOpen.value).toBe(false);
    expect(bridge.isCurrentPageLandscape.value).toBe(false);
    expect(bridge.currentPageSize.value).toBe('A4');

    bridge.onWordDocumentUpdate({} as WordDocumentDTO);
    bridge.onWordChange();
    expect(emit).toHaveBeenCalledWith('change');

    emit.mockClear();
    bridge.onWordContentUpdate('<p>Без редактора</p>');
    expect(emit).toHaveBeenNthCalledWith(1, 'update:content', '<p>Без редактора</p>');
    expect(emit).toHaveBeenNthCalledWith(2, 'change');
    expect(updateStats).not.toHaveBeenCalled();

    const mockEd = createMockEditor();
    editor.value = mockEd;
    bridge.onWordContentUpdate('<p>Текст</p>');
    expect(mockEd.commands.setContent).toHaveBeenCalledWith('<p>Текст</p>');
    expect(updateStats).toHaveBeenCalledTimes(1);
    expect(syncMarkdownFromEditor).toHaveBeenCalledTimes(1);
  });

  it('applies paragraph formatting for indent and non-indent modes, or no-ops when editor missing', () => {
    const editor = ref<Editor | undefined>(undefined);
    const bridge = useEditorWordBridge({
      editor,
      emit,
      syncMarkdownFromEditor,
      updateStats
    });

    bridge.isParagraphModalOpen.value = true;
    bridge.handleParagraphFormatApply({
      firstLineType: 'indent',
      firstLineCm: 1.25,
      leftIndentCm: 0.5,
      rightIndentCm: 0.25,
      lineHeight: 1.5
    } as ParagraphFormatData);
    expect(bridge.isParagraphModalOpen.value).toBe(true);

    const mockEd = createMockEditor();
    editor.value = mockEd;

    bridge.handleParagraphFormatApply({
      firstLineType: 'indent',
      firstLineCm: 1.25,
      leftIndentCm: 0.5,
      rightIndentCm: 0.25,
      lineHeight: 1.5
    } as ParagraphFormatData);

    expect(mockEd.commands.setParagraphIndent).toHaveBeenCalledWith(1.25);
    expect(mockEd.commands.setParagraphLeftMargin).toHaveBeenCalledWith(0.5);
    expect(mockEd.commands.setParagraphRightMargin).toHaveBeenCalledWith(0.25);
    expect(mockEd.commands.setParagraphLineHeight).toHaveBeenCalledWith(1.5);
    expect(bridge.isParagraphModalOpen.value).toBe(false);

    bridge.handleParagraphFormatApply({
      firstLineType: 'none',
      firstLineCm: 1.25,
      leftIndentCm: 0,
      rightIndentCm: 0,
      lineHeight: 1.15
    } as ParagraphFormatData);
    expect(mockEd.commands.setParagraphIndent).toHaveBeenLastCalledWith(0);
  });
});

