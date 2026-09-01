import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';
import { 
  CustomFontFamily, 
  CustomFontSize, 
  CustomUnderline, 
  CustomSubscript, 
  CustomSuperscript, 
  CustomHighlight, 
  PageBreakNode, 
  WordParagraphCommands 
} from '../extensions/WordFormatExtensions';

const createTestEditor = (content = '<p>Первый абзац документа</p><p>Второй абзац документа</p>') => {
  const CustomParagraph = Paragraph.extend({
    addAttributes() {
      return {
        textIndent: {
          default: null,
          parseHTML: (el) => el.style.textIndent || null,
          renderHTML: (attrs) => (attrs.textIndent ? { style: `text-indent: ${attrs.textIndent}` } : {}),
        },
        leftIndent: {
          default: null,
          parseHTML: (el) => el.style.paddingLeft || null,
          renderHTML: (attrs) => (attrs.leftIndent ? { style: `padding-left: ${attrs.leftIndent}` } : {}),
        },
        rightIndent: {
          default: null,
          parseHTML: (el) => el.style.paddingRight || null,
          renderHTML: (attrs) => (attrs.rightIndent ? { style: `padding-right: ${attrs.rightIndent}` } : {}),
        },
        lineHeight: {
          default: null,
          parseHTML: (el) => el.style.lineHeight || null,
          renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
        },
      };
    },
  });

  return new Editor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      CustomParagraph,
      CustomFontFamily,
      CustomFontSize,
      CustomUnderline,
      CustomSubscript,
      CustomSuperscript,
      CustomHighlight,
      PageBreakNode,
      WordParagraphCommands,
    ],
    content,
  });
};

describe('Word Formatting Engine - Isolation and Extensions', () => {
  it('1. Применяет гарнитуру шрифта строго к выделенному тексту, не затрагивая остальной документ', () => {
    const editor = createTestEditor('<p>Привет Мир</p>');

    // Выделяем слово "Мир" (символы с 8 по 11)
    editor.commands.setTextSelection({ from: 8, to: 11 });
    editor.commands.setFontFamily('Times New Roman');

    const html = editor.getHTML();
    expect(html).toContain('Привет <span style="font-family: &quot;Times New Roman&quot;;">Мир</span>');
    // Слово "Привет" осталось чистым без span
    expect(html).not.toContain('<span>Привет</span>');
    editor.destroy();
  });

  it('2. Применяет кегль (размер шрифта) строго к выделенному фрагменту', () => {
    const editor = createTestEditor('<p>Крупный текст</p>');

    editor.commands.setTextSelection({ from: 1, to: 8 });
    editor.commands.setFontSize('18pt');

    const html = editor.getHTML();
    expect(html).toContain('<span style="font-size: 18pt;">Крупный</span> текст');
    // Слово "текст" осталось чистым
    expect(html).not.toContain('<span style="font-size: 18pt;">текст</span>');
    editor.destroy();
  });

  it('3. Подчеркивание (u), подстрочный (sub) и надстрочный (sup) знаки работают корректно', () => {
    const editorSub = createTestEditor('<p>H2O</p>');
    editorSub.commands.setTextSelection({ from: 2, to: 3 });
    editorSub.commands.toggleSubscript();
    expect(editorSub.getHTML()).toContain('H<sub>2</sub>O');
    editorSub.destroy();

    const editorSup = createTestEditor('<p>E=mc2</p>');
    editorSup.commands.setTextSelection({ from: 5, to: 6 });
    editorSup.commands.toggleSuperscript();
    expect(editorSup.getHTML()).toContain('E=mc<sup>2</sup>');
    editorSup.destroy();

    const editorU = createTestEditor('<p>Важно</p>');
    editorU.commands.setTextSelection({ from: 1, to: 6 });
    editorU.commands.toggleUnderline();
    expect(editorU.getHTML()).toContain('<u>Важно</u>');
    editorU.destroy();
  });

  it('4. Отступ первой строки (красная строка) выставляется строго текущему абзацу', () => {
    const editor = createTestEditor('<p>Первый абзац</p><p>Второй абзац</p>');

    // Курсор стоит в первом абзаце
    editor.commands.setTextSelection(2);
    editor.commands.setParagraphIndent(1.25);

    const html = editor.getHTML();
    expect(html).toContain('<p style="text-indent: 1.25cm;">Первый абзац</p>');
    // Второй абзац НЕ имеет атрибута text-indent
    expect(html).toContain('<p>Второй абзац</p>');
    editor.destroy();
  });

  it('5. Левый и правый отступы абзаца меняются независимо', () => {
    const editor = createTestEditor('<p>Абзац с полями</p>');

    editor.commands.setTextSelection(2);
    editor.commands.setParagraphLeftMargin(2.0);
    editor.commands.setParagraphRightMargin(1.5);
    editor.commands.setParagraphLineHeight('1.5');

    const html = editor.getHTML();
    expect(html).toContain('padding-left: 2cm;');
    expect(html).toContain('padding-right: 1.5cm;');
    expect(html).toContain('line-height: 1.5;');
    editor.destroy();
  });

  it('6. Разрыв страницы успешно вставляется как блок PageBreakNode', () => {
    const editor = createTestEditor('<p>Конец первой страницы</p>');

    editor.commands.setTextSelection(2);
    editor.commands.insertPageBreak();

    const html = editor.getHTML();
    expect(html).toContain('word-page-break-node');
    expect(html).toContain('data-page-break="true"');
    editor.destroy();
  });
});
