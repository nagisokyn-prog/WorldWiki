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
      getHTML: vi.fn(() => '<p>Hello world</p>'),
      commands: {
        setContent: vi.fn(),
      },
    });
  });

  it('syncs markdown from HTML editor', () => {
    const md = useTiptapMarkdown(editor, emit, updateStats);

    md.syncMarkdownFromEditor();
    expect(md.markdownContent.value).toContain('Hello world');
  });

  it('preprocesses and inputs markdown', () => {
    const md = useTiptapMarkdown(editor, emit, updateStats);
    md.markdownContent.value = 'Paragraph 1\nParagraph 2';

    md.onMarkdownInput();
    expect(editor.value.commands.setContent).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('update:content', expect.any(String));
    expect(updateStats).toHaveBeenCalled();
  });
});
