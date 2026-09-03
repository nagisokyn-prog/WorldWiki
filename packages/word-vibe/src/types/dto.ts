/**
 * Публичные DTO-типы пакета @worldwiki/word-vibe.
 *
 * Являются чистыми TypeScript-интерфейсами (Plain Objects)
 * без зависимостей от Tiptap, ProseMirror или rk-editor-core.
 */

// ── Геометрия страницы ────────────────────────────────────────────────────────
export type PageSize = 'A4' | 'A5' | 'A3' | 'Letter' | 'B5';
export type Orientation = 'portrait' | 'landscape';

export interface MarginsMm {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface WordLayoutDTO {
  pageSize: PageSize;
  orientation: Orientation;
  marginsMm: MarginsMm;
}

// ── Колонтитулы ─────────────────────────────────────────────────────────────
export interface WordHeaderFooterDTO {
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

// ── Статистика документа ────────────────────────────────────────────────────
export interface WordStatsDTO {
  pageCount: number;
  wordCount: number;
  characterCount: number;
}

// ── Срез текущего выделения ──────────────────────────────────────────────────
export interface WordSelectionDTO {
  empty: boolean;
  isInsideTable: boolean;
  firstLineIndentCm: number;
  leftIndentCm: number;
  rightIndentCm: number;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrike?: boolean;
  isSubscript?: boolean;
  isSuperscript?: boolean;
  isHighlight?: boolean;
  isBlockquote?: boolean;
  isBulletList?: boolean;
  isOrderedList?: boolean;
  headingLevel?: number;
}

// ── SEMANTIC AST (Центральный формат обмена данными) ─────────────────────────

export interface WordDocumentDTO {
  id: string;
  metadata: WordDocumentMetadataDTO;
  profileId?: string;
  blocks: WordBlockDTO[];
}

export interface AcademicMetadataDTO {
  faculty?: string;
  department?: string;
  discipline?: string;
  studentGroup?: string;
  supervisor?: string;
  year?: number;
  city?: string;
}

export interface BookMetadataDTO {
  volumeNumber?: number;
  isbn?: string;
  publisher?: string;
  genres?: string[];
  annotation?: string;
}

export interface WordDocumentMetadataDTO {
  title: string;
  subtitle?: string;
  authors?: string[];
  createdAt?: number;
  updatedAt?: number;
  academic?: AcademicMetadataDTO;
  book?: BookMetadataDTO;
}

export type WordBlockDTO =
  | WordParagraphBlockDTO
  | WordHeadingBlockDTO
  | WordFigureBlockDTO
  | WordTableBlockDTO
  | WordEquationBlockDTO
  | WordQuoteBlockDTO
  | WordListBlockDTO
  | WordPageBreakBlockDTO
  | WordSceneBreakBlockDTO
  | WordUnsupportedBlockDTO;

export interface WordParagraphBlockDTO {
  type: 'paragraph';
  id: string;
  content: WordInlineDTO[];
  styleOverride?: {
    alignment?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
    firstLineIndentMm?: number;
    spaceBeforePt?: number;
    spaceAfterPt?: number;
  };
}

export interface WordHeadingBlockDTO {
  type: 'heading';
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: WordInlineDTO[];
  numberingMode?: 'auto' | 'none';
}

export interface WordFigureBlockDTO {
  type: 'figure';
  id: string;
  mediaUrl: string;
  captionContent: WordInlineDTO[];
  numberingMode?: 'global' | 'by_chapter' | 'none';
  alignment?: 'center' | 'left' | 'right';
  width?: string | number;
}

export interface WordTableBlockDTO {
  type: 'table';
  id: string;
  captionContent: WordInlineDTO[];
  numberingMode?: 'global' | 'by_chapter' | 'none';
  repeatHeaderOnPageBreak?: boolean;
  keepWithCaption?: boolean;
  columnWidths?: number[];
  rows: WordTableRowDTO[];
}

export interface WordTableRowDTO {
  id: string;
  isHeader?: boolean;
  cells: WordTableCellDTO[];
}

export interface WordTableCellDTO {
  id: string;
  content: WordBlockDTO[];
  isHeader?: boolean;
  colSpan?: number;
  rowSpan?: number;
  alignment?: 'left' | 'center' | 'right';
}

export interface WordEquationBlockDTO {
  type: 'equation';
  id: string;
  latex: string;
  numberingMode?: 'auto' | 'none';
}

export interface WordQuoteBlockDTO {
  type: 'quote';
  id: string;
  content: WordBlockDTO[];
  citationAuthor?: string;
}

export interface WordListBlockDTO {
  type: 'list';
  id: string;
  variant: 'bullet' | 'ordered';
  items: WordListItemDTO[];
}

export interface WordListItemDTO {
  id: string;
  content: WordBlockDTO[];
}

export interface WordPageBreakBlockDTO {
  type: 'page_break';
  id: string;
}

export interface WordSceneBreakBlockDTO {
  type: 'scene_break';
  id: string;
  variant: 'asterisms' | 'line' | 'space';
}

/**
 * Неподдерживаемый узел AST (Zero Data Loss).
 * Сохраняется в неизменном виде и восстанавливается при сериализации.
 */
export interface WordUnsupportedBlockDTO {
  type: 'unsupported';
  id: string;
  originalType: string;
  originalAttrs?: Record<string, unknown>;
  originalContent?: (WordBlockDTO | WordInlineDTO)[];
  reason?: string;
}

// ── ИНЛАЙНОВЫЕ УЗЛЫ ─────────────────────────────────────────────────────────

export type WordInlineDTO =
  | WordTextInlineDTO
  | WordMathInlineDTO
  | WordCrossReferenceInlineDTO
  | WordFootnoteReferenceInlineDTO
  | WordEntityReferenceInlineDTO;

export interface WordTextInlineDTO {
  type: 'text';
  text: string;
  marks?: WordTextMarkDTO[];
}

export type WordTextMarkDTO =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'subscript' }
  | { type: 'superscript' }
  | { type: 'color'; color: string }
  | { type: 'highlight'; color: string }
  | { type: 'fontFamily'; font: string }
  | { type: 'fontSize'; sizePt: number }
  | { type: 'link'; href: string; title?: string };

export interface WordMathInlineDTO {
  type: 'math_inline';
  latex: string;
}

export interface WordFootnoteReferenceInlineDTO {
  type: 'footnote_reference';
  id: string;
  content: WordInlineDTO[];
}

export interface WordCrossReferenceInlineDTO {
  type: 'cross_reference';
  targetId: string;
  kind: 'heading' | 'figure' | 'table' | 'equation' | 'page';
  displayMode: 'full' | 'short' | 'number_only';
}

export interface WordEntityReferenceInlineDTO {
  type: 'entity_reference';
  id: string;
  entityType: string;
  name: string;
  url?: string;
}
