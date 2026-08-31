import EditorRuler from '@devslab/editor-ruler-tiptap';
import Mathematics from '@tiptap/extension-mathematics';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import { PaginationPlus } from 'tiptap-pagination-plus';
import type { PaginationRuntimeConfig } from '../../../services/document/layout/types';
import { CrossReferenceExtension } from '../nodes/CrossReference/CrossReferenceExtension';
import { FigureExtension } from '../nodes/FigureNode/FigureExtension';
import { FootnoteExtension } from '../nodes/FootnoteNode/FootnoteExtension';
import { LineHeightExtension } from './LineHeightExtension';
import { TextIndentExtension } from './TextIndentExtension';

export * from './LineHeightExtension';
export * from './TextIndentExtension';

/**
 * Creates the complete list of Tiptap extensions for the WorldWiki Document Processor.
 */
export function createDocumentEditorExtensions(options?: {
  defaultAlignment?: 'left' | 'justify';
  defaultLineHeight?: string;
  defaultFirstLineIndent?: string;
  pagination?: Partial<PaginationRuntimeConfig>;
  rulerVisible?: boolean;
}) {
  const paginationConfig = options?.pagination;

  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6]
      }
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: options?.defaultAlignment || 'justify'
    }),
    Mathematics.configure({
      katexOptions: {
        throwOnError: false
      }
    }),
    LineHeightExtension.configure({
      defaultLineHeight: options?.defaultLineHeight || '1.5'
    }),
    TextIndentExtension.configure({
      defaultIndent: options?.defaultFirstLineIndent || '12.5mm'
    }),
    FigureExtension,
    FootnoteExtension,
    CrossReferenceExtension,
    PaginationPlus.configure({
      enabled: paginationConfig?.enabled ?? true,
      pageWidth: paginationConfig?.pageWidth ?? 794,
      pageHeight: paginationConfig?.pageHeight ?? 1123,
      marginTop: paginationConfig?.marginTop ?? 76,
      marginBottom: paginationConfig?.marginBottom ?? 76,
      marginLeft: paginationConfig?.marginLeft ?? 113,
      marginRight: paginationConfig?.marginRight ?? 38,
      headerRight: paginationConfig?.headerRight ?? '{page}',
      headerLeft: paginationConfig?.headerLeft ?? '',
      footerRight: paginationConfig?.footerRight ?? '',
      footerLeft: paginationConfig?.footerLeft ?? ''
    }),
    EditorRuler.configure({
      visible: options?.rulerVisible ?? true,
      unit: 'cm'
    })
  ];
}
