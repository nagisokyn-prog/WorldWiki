import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EnterHandler, SemanticParagraph } from './SemanticExtensions';

const mockDetectActiveEntityQuery = vi.fn();

vi.mock('@/services/Manuscript/manuscript.wasm-bridge', () => ({
  detectActiveEntityQuery: (...args: unknown[]) => mockDetectActiveEntityQuery(...args)
}));

vi.mock('@/features/chapters/components/semantic/Semantic/SemanticParagraphNode.vue', () => ({
  default: {
    name: 'SemanticParagraphNode',
    template: '<div data-testid="semantic-paragraph"><slot /></div>'
  }
}));

describe('SemanticExtensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SemanticParagraph parses and renders all custom attributes', () => {
    const editor = new Editor({
      extensions: [StarterKit.configure({ paragraph: false }), SemanticParagraph],
      content:
        '<p data-id="id-1" data-block-id="blk-1" data-semantic-tag="dialog" data-diff="diff-block-added" style="text-indent: 20px; padding-left: 10px; padding-right: 12px; line-height: 1.5; text-align: center;">Привет</p>'
    });

    const attrs = editor.getJSON().content?.[0]?.attrs;
    expect(attrs).toMatchObject({
      id: 'id-1',
      block_id: 'blk-1',
      semanticTag: 'dialog',
      textIndent: '20px',
      leftIndent: '10px',
      rightIndent: '12px',
      lineHeight: '1.5',
      textAlign: 'center',
      diffClass: 'diff-block-added'
    });

    const html = editor.getHTML();
    expect(html).toContain('data-id="id-1"');
    expect(html).toContain('data-block-id="blk-1"');
    expect(html).toContain('data-semantic-tag="dialog"');
    expect(html).toContain('data-diff="diff-block-added"');

    // Empty attributes render cleanly without optional attributes
    const emptyEditor = new Editor({
      extensions: [StarterKit.configure({ paragraph: false }), SemanticParagraph],
      content: '<p class="diff-block-removed">Текст</p>'
    });
    const emptyAttrs = emptyEditor.getJSON().content?.[0]?.attrs;
    expect(emptyAttrs?.diffClass).toBe('diff-block-removed');
    expect(emptyAttrs?.id).toBeNull();
    expect(emptyEditor.getHTML()).toContain('data-semantic-tag="desc"');

    editor.destroy();
    emptyEditor.destroy();
  });

  it('EnterHandler handles Enter, Shift-Enter, (, Mod-q, and Mod-й shortcuts', () => {
    const editor = new Editor({
      extensions: [StarterKit, EnterHandler],
      content: '<p>Алиса и Боб</p>'
    });

    const shortcuts = (
      EnterHandler.config.addKeyboardShortcuts as (this: { editor: Editor }) => Record<
        string,
        (ctx: { editor: Editor }) => boolean
      >
    ).call({ editor });

    expect(shortcuts.Enter({ editor })).toBe(false);
    expect(shortcuts['Shift-Enter']({ editor })).toBe(true);

    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    document.addEventListener('ww:open-entity-selector', listener);

    // Collapsed selection -> '(' returns false
    editor.commands.setTextSelection(1);
    expect(shortcuts['(']({ editor })).toBe(false);

    // Non-empty selection -> '(' wraps in ((...)) and dispatches event
    editor.commands.setTextSelection({ from: 1, to: 7 });
    expect(shortcuts['(']({ editor })).toBe(true);
    expect(events[0].detail).toEqual({ target: 'wysiwyg', query: 'Алиса' });

    // Mod-q with non-empty selection
    editor.commands.setTextSelection({ from: 1, to: 4 });
    expect(shortcuts['Mod-q']({ editor })).toBe(true);

    // Mod-q with collapsed selection and active trigger
    editor.commands.setTextSelection(2);
    mockDetectActiveEntityQuery.mockReturnValueOnce({ query: 'Боб' });
    expect(shortcuts['Mod-q']({ editor })).toBe(true);
    expect(events[events.length - 1].detail).toEqual({ target: 'wysiwyg', query: 'Боб' });

    // Mod-q with collapsed selection and no trigger
    mockDetectActiveEntityQuery.mockReturnValueOnce(null);
    expect(shortcuts['Mod-q']({ editor })).toBe(true);
    expect(events[events.length - 1].detail).toEqual({ target: 'wysiwyg' });

    // Mod-й with non-empty selection, trigger, and no trigger
    editor.commands.setTextSelection({ from: 1, to: 3 });
    expect(shortcuts['Mod-й']({ editor })).toBe(true);

    editor.commands.setTextSelection(2);
    mockDetectActiveEntityQuery.mockReturnValueOnce({ query: 'Алиса' });
    expect(shortcuts['Mod-й']({ editor })).toBe(true);

    mockDetectActiveEntityQuery.mockReturnValueOnce(null);
    expect(shortcuts['Mod-й']({ editor })).toBe(true);

    document.removeEventListener('ww:open-entity-selector', listener);
    editor.destroy();
  });
});
