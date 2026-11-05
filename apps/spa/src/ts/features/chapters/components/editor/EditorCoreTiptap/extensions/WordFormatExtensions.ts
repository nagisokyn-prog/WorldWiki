import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export const TABLE_CAPTION_RE = /^Таблица (\d+) — /;
export function countTableCaptions(doc: ProseMirrorNode): number {
  let count = 0;
  doc.descendants((node: ProseMirrorNode) => {
    if (node.type.name === 'paragraph' && TABLE_CAPTION_RE.test((node.textContent || '').trim())) {
      count += 1;
    }
  });
  return count;
}
export function nextTableCaptionNumber(doc: ProseMirrorNode): number {
  return countTableCaptions(doc) + 1;
}
export function buildTableCaptionText(number: number, title?: string): string {
  return `Таблица ${number} — ${title && title.trim() ? title.trim() : '(название таблицы)'}`;
}

export const FIGURE_CAPTION_RE = /^Рисунок (\d+) — /;
export function countFigureCaptions(doc: ProseMirrorNode): number {
  let count = 0;
  doc.descendants((node: ProseMirrorNode) => {
    if (node.type.name === 'paragraph' && FIGURE_CAPTION_RE.test((node.textContent || '').trim())) {
      count += 1;
    }
  });
  return count;
}
export function nextFigureCaptionNumber(doc: ProseMirrorNode): number {
  return countFigureCaptions(doc) + 1;
}
export function buildFigureCaptionText(number: number, title?: string): string {
  return `Рисунок ${number} — ${title && title.trim() ? title.trim() : '(описание рисунка)'}`;
}

// 1. Mark: Семейство шрифтов (применяется строго к выделенному тексту)
export const CustomFontFamily = Mark.create({
  name: 'fontFamily',

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: element => element.style.fontFamily?.replace(/['"]/g, ''),
        renderHTML: attributes => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },

  parseHTML() {
    return [{ style: 'font-family' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontFamily: (font: string) => ({ chain }) => {
        return chain().setMark(this.name, { fontFamily: font }).run();
      },
      unsetFontFamily: () => ({ chain }) => {
        return chain().unsetMark(this.name).run();
      },
    };
  },
});

// 2. Mark: Кегль шрифта (применяется строго к выделенному тексту)
export const CustomFontSize = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize,
        renderHTML: attributes => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },

  parseHTML() {
    return [{ style: 'font-size' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }) => {
        return chain().setMark(this.name, { fontSize: size }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().unsetMark(this.name).run();
      },
    };
  },
});

// 3. Node: Разрыв страницы (Page Break)
export const PageBreakNode = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [
      { tag: 'hr.page-break' },
      { tag: 'div.word-page-break-node' },
      { tag: '[data-page-break]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'word-page-break-node',
        'data-page-break': 'true',
        contenteditable: 'false',
      }),
      [
        'div',
        { class: 'page-break-label' },
        '─── Разрыв страницы (ГОСТ 7.32) ───',
      ],
    ];
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ commands }) => {
        return commands.insertContent([
          { type: this.name },
          { type: 'paragraph' }
        ]);
      },
    };
  },
});

// 4. Mark: Подчеркивание (u)
export const CustomUnderline = Mark.create({
  name: 'underline',
  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration=underline' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleUnderline: () => ({ chain }) => {
        return chain().toggleMark(this.name).run();
      },
    };
  },
});

// 5. Mark: Подстрочный индекс (sub)
export const CustomSubscript = Mark.create({
  name: 'subscript',
  parseHTML() {
    return [{ tag: 'sub' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSubscript: () => ({ chain }) => {
        return chain().toggleMark(this.name).run();
      },
    };
  },
});

// 6. Mark: Надстрочный индекс (sup)
export const CustomSuperscript = Mark.create({
  name: 'superscript',
  parseHTML() {
    return [{ tag: 'sup' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSuperscript: () => ({ chain }) => {
        return chain().toggleMark(this.name).run();
      },
    };
  },
});

// 7. Mark: Маркер выделения (highlight)
export const CustomHighlight = Mark.create({
  name: 'highlight',
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleHighlight: () => ({ chain }) => {
        return chain().toggleMark(this.name).run();
      },
    };
  },
});

// 8. Extension: Команды форматирования абзаца
export const WordParagraphCommands = Extension.create({
  name: 'wordParagraphCommands',

  addCommands() {
    return {
      setParagraphIndent: (indentCm: number) => ({ commands }) => {
        return commands.updateAttributes('paragraph', {
          textIndent: indentCm > 0 ? `${indentCm}cm` : null,
        });
      },
      setParagraphLeftMargin: (leftCm: number) => ({ commands }) => {
        return commands.updateAttributes('paragraph', {
          leftIndent: leftCm > 0 ? `${leftCm}cm` : null,
        });
      },
      setParagraphRightMargin: (rightCm: number) => ({ commands }) => {
        return commands.updateAttributes('paragraph', {
          rightIndent: rightCm > 0 ? `${rightCm}cm` : null,
        });
      },
      setParagraphLineHeight: (lineHeight: string) => ({ commands }) => {
        return commands.updateAttributes('paragraph', {
          lineHeight: lineHeight || null,
        });
      },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customFontFamily: {
      setFontFamily: (font: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
    customFontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    customUnderline: {
      toggleUnderline: () => ReturnType;
    };
    customSubscript: {
      toggleSubscript: () => ReturnType;
    };
    customSuperscript: {
      toggleSuperscript: () => ReturnType;
    };
    customHighlight: {
      toggleHighlight: () => ReturnType;
    };
    pageBreakNode: {
      insertPageBreak: () => ReturnType;
    };
    wordParagraphCommands: {
      setParagraphIndent: (indentCm: number) => ReturnType;
      setParagraphLeftMargin: (leftCm: number) => ReturnType;
      setParagraphRightMargin: (rightCm: number) => ReturnType;
      setParagraphLineHeight: (lineHeight: string) => ReturnType;
    };
  }
}
