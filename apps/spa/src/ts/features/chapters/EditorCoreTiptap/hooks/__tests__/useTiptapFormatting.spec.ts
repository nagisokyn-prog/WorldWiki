import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTiptapFormatting } from '../useTiptapFormatting';

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn().mockResolvedValue(true),
}));

describe('useTiptapFormatting', () => {
  let editor: any;
  let emit: any;
  let editorUpdateKey: any;

  beforeEach(() => {
    emit = vi.fn();
    editorUpdateKey = ref(0);
    editor = ref({
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          toggleBold: vi.fn(() => ({ run: vi.fn() })),
          toggleItalic: vi.fn(() => ({ run: vi.fn() })),
          toggleStrike: vi.fn(() => ({ run: vi.fn() })),
          toggleHeading: vi.fn(() => ({ run: vi.fn() })),
          toggleBlockquote: vi.fn(() => ({ run: vi.fn() })),
          toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
          toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
          clearNodes: vi.fn(() => ({ unsetLink: vi.fn(() => ({ run: vi.fn() })) })),
          setImage: vi.fn(() => ({ run: vi.fn() })),
          setLink: vi.fn(() => ({ insertContent: vi.fn(() => ({ run: vi.fn() })) })),
          insertTable: vi.fn(() => ({ run: vi.fn() })),
          insertContent: vi.fn(() => ({ run: vi.fn() })),
        })),
      })),
      state: {
        doc: {
          descendants: (cb: any) => {
            cb({ type: { name: 'paragraph' }, attrs: { semanticTag: 'desc' } }, 0);
          },
        },
        tr: {
          setNodeMarkup: vi.fn(),
        },
      },
      view: {
        dispatch: vi.fn(),
      },
    });
  });

  it('toggles formatting marks and inserts media/tables/links', () => {
    globalThis.prompt = vi.fn().mockReturnValue('http://example.com/image.png');

    const formatting = useTiptapFormatting(editor, emit, editorUpdateKey);

    formatting.toggleBold();
    formatting.toggleItalic();
    formatting.setHeading(2);
    formatting.toggleBlockquote();
    formatting.toggleBulletList();
    formatting.toggleOrderedList();
    formatting.clearFormatting();

    formatting.insertImage();
    formatting.insertLink();
    formatting.insertTable();

    expect(editor.value.chain).toHaveBeenCalled();
  });

  it('handles global semantic tags', async () => {
    const formatting = useTiptapFormatting(editor, emit, editorUpdateKey);

    formatting.cycleGlobalTag(0);
    expect(editor.value.view.dispatch).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('change');
  });

  describe('Null-guard and branch edge cases for useTiptapFormatting', () => {
    it('handles null editor and prompt cancellations across all actions', async () => {
      const nullEditor = ref(null);
      const formattingNull = useTiptapFormatting(nullEditor, emit, editorUpdateKey);

      // Prompt cancellations with null editor
      globalThis.prompt = vi.fn().mockReturnValue(null);
      formattingNull.insertImage();
      formattingNull.insertLink();
      formattingNull.insertTable();
      formattingNull.clearFormatting();
      formattingNull.cycleGlobalTag(0);

      // Prompt cancellations with valid editor
      const formatting = useTiptapFormatting(editor, emit, editorUpdateKey);
      formatting.insertImage();
      formatting.insertLink();

      // First prompt ok, second prompt null for link
      globalThis.prompt = vi.fn()
        .mockReturnValueOnce('Link text')
        .mockReturnValueOnce(null);
      formatting.insertLink();
    });

    it('cycles global semantic tags correctly for dialog and thought', () => {
      // Setup descendants with dialog and thought
      let currentTag = 'dialog';
      editor.value.state.doc.descendants = (cb: any) => {
        cb({ type: { name: 'paragraph' }, attrs: { semanticTag: currentTag } }, 0);
      };

      const formatting = useTiptapFormatting(editor, emit, editorUpdateKey);

      // dialog -> thought
      formatting.cycleGlobalTag(0);
      expect(editor.value.view.dispatch).toHaveBeenCalled();

      // thought -> desc
      currentTag = 'thought';
      formatting.cycleGlobalTag(0);
      expect(editor.value.view.dispatch).toHaveBeenCalled();

      // multiple paragraphs, target second paragraph (covers line 79 currentPIndex++)
      editor.value.state.doc.descendants = (cb: any) => {
        cb({ type: { name: 'paragraph' }, attrs: { semanticTag: 'desc' } }, 0);
        cb({ type: { name: 'paragraph' }, attrs: { semanticTag: 'desc' } }, 10);
      };
      editor.value.view.dispatch.mockClear();
      formatting.cycleGlobalTag(1);
      expect(editor.value.view.dispatch).toHaveBeenCalled();

      // semanticTag is undefined (falls back to desc -> dialog)
      editor.value.state.doc.descendants = (cb: any) => {
        cb({ type: { name: 'paragraph' }, attrs: {} }, 0);
      };
      editor.value.view.dispatch.mockClear();
      formatting.cycleGlobalTag(0);
      expect(editor.value.view.dispatch).toHaveBeenCalled();

      // semanticTag is empty string (covers line 84 falsy fallback)
      editor.value.state.doc.descendants = (cb: any) => {
        cb({ type: { name: 'paragraph' }, attrs: { semanticTag: '' } }, 0);
      };
      editor.value.view.dispatch.mockClear();
      formatting.cycleGlobalTag(0);
      expect(editor.value.view.dispatch).toHaveBeenCalled();

      // paragraph not found (pos === -1)
      editor.value.state.doc.descendants = (cb: any) => {
        cb({ type: { name: 'heading' }, attrs: {} }, 0);
      };
      editor.value.view.dispatch.mockClear();
      formatting.cycleGlobalTag(99);
      expect(editor.value.view.dispatch).not.toHaveBeenCalled();
    });
  });
});

