import type { Editor } from '@tiptap/core';
import type { WordSelectionDTO } from '../types/dto';

export const PX_PER_CM = 37.7952755906;
export const INDENT_STEP_PX = 37.7952755906 * 1.25;

export interface WordEditorHost {
  instance?: Editor;
  commands?: Editor['commands'];
  destroy?: () => void;
  setDocument?: (doc: unknown) => void;
  getHTML?: () => string;
  focus?: () => void;
  setPageLayout?: (layout: unknown) => void;
  exportDocx?: (filename: string) => Promise<void>;
  printPdf?: (opts: { title: string }) => void;
  [key: string]: unknown;
}

export function buildSelectionDTO(
  activeTiptapEditor: Editor | null,
  wordEditor: unknown
): WordSelectionDTO {
  const ed = activeTiptapEditor || ((wordEditor as unknown as WordEditorHost)?.instance);
  if (!ed) {
    return {
      empty: true,
      isInsideTable: false,
      firstLineIndentCm: 0,
      leftIndentCm: 0,
      rightIndentCm: 0,
    };
  }

  let alignment: 'left' | 'center' | 'right' | 'justify' | undefined;
  if (ed.isActive?.({ textAlign: 'center' })) alignment = 'center';
  else if (ed.isActive?.({ textAlign: 'right' })) alignment = 'right';
  else if (ed.isActive?.({ textAlign: 'justify' })) alignment = 'justify';
  else if (ed.isActive?.({ textAlign: 'left' })) alignment = 'left';

  const isInsideTable = Boolean(
    ed.isActive?.('table') ||
    ed.isActive?.('tableRow') ||
    ed.isActive?.('tableCell') ||
    ed.isActive?.('tableHeader')
  );

  let firstLineIndentCm = 0;
  let leftIndentCm = 0;
  const rightIndentCm = 0;
  const empty = ed.state?.selection?.empty ?? true;

  try {
    const selection = ed.state?.selection;
    if (selection) {
      const { $from } = selection;
      for (let d = $from.depth; d >= 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'paragraph') {
          const indentLevel = typeof node.attrs.indent === 'number' ? node.attrs.indent : 0;
          leftIndentCm = (indentLevel * INDENT_STEP_PX) / PX_PER_CM;

          const rawFirstLine = node.attrs.firstLineIndent;
          if (rawFirstLine && typeof rawFirstLine === 'string') {
            const parsed = parseFloat(rawFirstLine);
            if (!isNaN(parsed)) {
              if (rawFirstLine.endsWith('mm')) firstLineIndentCm = parsed / 10;
              else if (rawFirstLine.endsWith('pt')) firstLineIndentCm = parsed * 0.0352778;
              else firstLineIndentCm = parsed;
            }
          }
          break;
        }
      }
    }
  } catch {
    // ignore
  }

  return {
    empty,
    isInsideTable,
    firstLineIndentCm,
    leftIndentCm,
    rightIndentCm,
    alignment,
    isBold: Boolean(ed.isActive?.('bold')),
    isItalic: Boolean(ed.isActive?.('italic')),
    isUnderline: Boolean(ed.isActive?.('underline')),
    isStrike: Boolean(ed.isActive?.('strike')),
    isSubscript: Boolean(ed.isActive?.('subscript')),
    isSuperscript: Boolean(ed.isActive?.('superscript')),
    isHighlight: Boolean(ed.isActive?.('highlight')),
    isBlockquote: Boolean(ed.isActive?.('blockquote')),
    isBulletList: Boolean(ed.isActive?.('bulletList')),
    isOrderedList: Boolean(ed.isActive?.('orderedList')),
    headingLevel: ed.isActive?.('heading', { level: 1 }) ? 1 : ed.isActive?.('heading', { level: 2 }) ? 2 : ed.isActive?.('heading', { level: 3 }) ? 3 : undefined,
  };
}
