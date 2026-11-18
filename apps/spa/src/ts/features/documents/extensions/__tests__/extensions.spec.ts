import { describe, expect, it } from 'vitest';
import { createDocumentEditorExtensions } from '../index';

describe('DocumentEditorExtensions', () => {
  it('creates full set of document editor extensions', () => {
    const extensions = createDocumentEditorExtensions({
      defaultAlignment: 'justify',
      defaultLineHeight: '1.5',
      defaultFirstLineIndent: '12.5mm'
    });

    expect(extensions.length).toBeGreaterThanOrEqual(8);

    const names = extensions.map((ext: { name?: string }) => ext.name);
    expect(names).toContain('textAlign');
    expect(names.some(n => n?.toLowerCase() === 'mathematics')).toBe(true);
    expect(names).toContain('lineHeight');
    expect(names).toContain('textIndent');
    expect(names).toContain('figure');
    expect(names).toContain('footnote_reference');
    expect(names).toContain('cross_reference');
    expect(names.some(n => n?.toLowerCase().includes('pagination'))).toBe(true);
    expect(names.some(n => n?.toLowerCase().includes('ruler'))).toBe(true);
  });

  it('executes TextIndentExtension and LineHeightExtension commands, parseHTML, and renderHTML', async () => {
    const { Editor } = await import('@tiptap/core');
    const Document = (await import('@tiptap/extension-document')).default;
    const Paragraph = (await import('@tiptap/extension-paragraph')).default;
    const Heading = (await import('@tiptap/extension-heading')).default;
    const Text = (await import('@tiptap/extension-text')).default;
    const { TextIndentExtension } = await import('../TextIndentExtension');
    const { LineHeightExtension } = await import('../LineHeightExtension');

    const editor = new Editor({
      extensions: [Document, Paragraph, Heading, Text, TextIndentExtension, LineHeightExtension],
      content: '<p style="text-indent: 10mm; line-height: 1.5">Текст</p>',
    });

    expect(editor.getHTML()).toContain('text-indent: 10mm');
    expect(editor.getHTML()).toContain('line-height: 1.5');

    editor.commands.setFirstLineIndent(15);
    editor.commands.setLineHeight(2);
    expect(editor.getHTML()).toContain('text-indent: 15mm');
    expect(editor.getHTML()).toContain('line-height: 2');

    editor.commands.unsetFirstLineIndent();
    editor.commands.unsetLineHeight();
    expect(editor.getHTML()).not.toContain('text-indent');
    expect(editor.getHTML()).not.toContain('line-height');

    editor.destroy();
  });
});
