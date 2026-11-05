import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Mathematics } from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { AiGhostTextExtension } from '../AiGhostTextExtension';
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
import { EnterHandler, SemanticParagraph } from '../extensions/SemanticExtensions';
import type { AnyExtension } from '@tiptap/core';

export function createTiptapExtensions(project: string): AnyExtension[] {
  return [
    StarterKit.configure({
      paragraph: false,
      link: false,
      underline: false,
      dropcursor: { color: 'var(--color-accent)', width: 2 }
    }),
    SemanticParagraph,
    EnterHandler,
    Image.configure({ inline: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'chapter-entity-link' }
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph']
    }),
    Mathematics.configure({
      katexOptions: { throwOnError: false }
    }),
    Table.configure({
      resizable: true
    }),
    TableRow,
    TableHeader,
    TableCell,
    CustomFontFamily,
    CustomFontSize,
    CustomUnderline,
    CustomSubscript,
    CustomSuperscript,
    CustomHighlight,
    PageBreakNode,
    WordParagraphCommands,
    AiGhostTextExtension.configure({ projectId: project })
  ] as AnyExtension[];
}
