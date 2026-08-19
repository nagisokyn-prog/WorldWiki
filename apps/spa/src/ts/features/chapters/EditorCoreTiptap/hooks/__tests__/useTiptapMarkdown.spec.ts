import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTiptapMarkdown } from '../useTiptapMarkdown';

describe('useTiptapMarkdown', () => {
  let editor: any;
  let emit: any;
  let updateStats: any;

  beforeEach(() => {
    emit = vi.fn();
    updateStats = vi.fn();
    editor = ref({
      getHTML: vi.fn(() => '<p>Hello world</p><a href="/ui_editor.html?id=1">Hero</a>'),
      commands: {
        setContent: vi.fn(),
      },
    });
  });

  it('handles preprocessMarkdown with code blocks, quotes, soft breaks, and blank lines', () => {
    const md = useTiptapMarkdown(editor, emit, updateStats);

    const input = [
      '```javascript',
      'const a = 1;',
      'const b = 2;',
      '```',
      '> quote line 1',
      '> quote line 2',
      'soft break  ',
      'next line\\',
      'another line',
      'normal 1',
      'normal 2',
    ].join('\n');

    const result = md.preprocessMarkdown(input);
    expect(result).toBeDefined();
  });

  it('syncs markdown from HTML editor and handles entity links rule and errors', () => {
    const md = useTiptapMarkdown(editor, emit, updateStats);

    md.syncMarkdownFromEditor();
    expect(md.markdownContent.value).toContain('Hello world');

    // Null editor
    editor.value = null;
    md.syncMarkdownFromEditor();

    // Turndown error handling
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    editor.value = {
      getHTML: () => '<div>Invalid</div>',
    };
    const { turndownService } = md as any;
    // Call with invalid HTML string or throw within turndown
    vi.spyOn(turndownService, 'turndown').mockImplementationOnce(() => {
      throw new Error('Turndown parse failure');
    });
    md.syncMarkdownFromEditor();
    expect(logSpy).toHaveBeenCalledWith('Turndown error (non-critical):', expect.any(Error));
    logSpy.mockRestore();
  });

  it('handles onMarkdownInput with entity link conversions and missing editor', () => {
    const md = useTiptapMarkdown(editor, emit, updateStats);
    md.markdownContent.value = 'Check ((Hero))[ui_editor.html?type=char&id=1] in story.';

    md.onMarkdownInput();
    expect(editor.value.commands.setContent).toHaveBeenCalledWith(
      expect.stringContaining('<a href="/ui_editor.html?type=char&amp;id=1">Hero</a>')
    );
    expect(emit).toHaveBeenCalledWith('update:content', expect.any(String));
    expect(emit).toHaveBeenCalledWith('change');
    expect(updateStats).toHaveBeenCalled();

    // Null editor
    editor.value = null;
    md.onMarkdownInput();
  });

  describe('onMarkdownKeydown', () => {
    it('wraps selected text in parentheses on "(" key press', () => {
      const md = useTiptapMarkdown(editor, emit, updateStats);
      document.execCommand = vi.fn();

      const textarea = document.createElement('textarea');
      textarea.value = 'hello Arthur world';
      textarea.selectionStart = 6;
      textarea.selectionEnd = 12;

      const event = {
        key: '(',
        target: textarea,
        preventDefault: vi.fn(),
      } as any;

      md.onMarkdownKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, '(Arthur)');

      // With no selection
      textarea.selectionStart = 5;
      textarea.selectionEnd = 5;
      const noSelectEvent = { key: '(', target: textarea, preventDefault: vi.fn() } as any;
      md.onMarkdownKeydown(noSelectEvent);
      expect(noSelectEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('handles Ctrl+Q / Mod-Q / Mod-й to trigger entity selector', () => {
      const md = useTiptapMarkdown(editor, emit, updateStats);
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

      const textarea = document.createElement('textarea');
      textarea.value = 'Mentioning ((Arthur))';
      textarea.selectionStart = textarea.value.length;

      const qEvent = {
        key: 'q',
        ctrlKey: true,
        target: textarea,
        preventDefault: vi.fn(),
      } as any;

      md.onMarkdownKeydown(qEvent);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ww:open-entity-selector',
          detail: { target: 'markdown' },
        })
      );

      // Without entity pattern
      textarea.value = 'normal text without parens';
      textarea.selectionStart = textarea.value.length;
      md.onMarkdownKeydown(qEvent);
    });
  });
});
