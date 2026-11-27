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
import { DiffInsertion, DiffDeletion } from '../extensions/DiffMarks';
import { NarrativeFramesExtension } from '../extensions/NarrativeFramesExtension';
import UniqueID from '@tiptap/extension-unique-id';
import type { AnyExtension } from '@tiptap/core';

export const BlockUniqueID = UniqueID.extend({
  addGlobalAttributes() {
    const parentAttrs = this.parent?.() || [];
    return parentAttrs.map((entry) => ({
      ...entry,
      attributes: {
        [this.options.attributeName]: {
          default: null,
          keepOnSplit: false,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute('data-block-id') ||
            element.getAttribute(`data-${this.options.attributeName}`) ||
            element.getAttribute('data-id'),
          renderHTML: (attributes: Record<string, unknown>) => {
            const val = attributes[this.options.attributeName];
            return val ? { 'data-block-id': val } : {};
          }
        }
      }
    }));
  }
});

export function createTiptapExtensions(project: string): AnyExtension[] {
  return [
    StarterKit.configure({
      paragraph: false,
      link: false,
      underline: false,
      dropcursor: { color: 'var(--color-accent)', width: 2 }
    }),
    SemanticParagraph,
    BlockUniqueID.configure({
      attributeName: 'block_id',
      types: ['paragraph', 'heading', 'blockquote'],
      generateID: () =>
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `blk_${crypto.randomUUID()}`
          : `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    }),
    NarrativeFramesExtension,
    EnterHandler,
    DiffInsertion,
    DiffDeletion,
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
