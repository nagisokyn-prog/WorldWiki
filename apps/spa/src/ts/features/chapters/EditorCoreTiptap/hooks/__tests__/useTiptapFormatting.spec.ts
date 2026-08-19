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

  it('handles footnotes and global semantic tags', async () => {
    globalThis.prompt = vi.fn().mockReturnValue('Сноска 1');

    const formatting = useTiptapFormatting(editor, emit, editorUpdateKey);

    formatting.insertFootnote();
    expect(emit).toHaveBeenCalledWith('update:footnotesData', expect.any(Object));

    await formatting.deleteFootnote('fn1');
    expect(emit).toHaveBeenCalledWith('update:footnotesData', expect.any(Object));

    formatting.cycleGlobalTag(0);
    expect(editor.value.view.dispatch).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('change');
  });
});
