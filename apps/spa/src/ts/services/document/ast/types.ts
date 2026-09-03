/**
 * Core Semantic AST Types for WorldWiki Document Engine.
 * Source of truth for document representation.
 * Strict typing without any 'any'.
 */

export interface VersionedDocument {
  schemaVersion: number;
  document: SemanticDocument;
}

export interface SemanticDocument {
  id: string; // Document UUID
  metadata: DocumentMetadata;
  profileId: string; // Associated DocumentProfile ID
  blocks: BlockNode[];
}

export interface DocumentMetadata {
  title: string;
  subtitle?: string;
  authors?: string[];
  createdAt?: number;
  updatedAt?: number;
  academic?: AcademicMetadata;
  book?: BookMetadata;
}

export interface AcademicMetadata {
  faculty?: string;
  department?: string;
  discipline?: string;
  studentGroup?: string;
  supervisor?: string;
  year: number;
  city: string;
}

export interface BookMetadata {
  volumeNumber?: number;
  isbn?: string;
  publisher?: string;
  genres: string[];
  annotation?: string;
}

/* =========================================================================
   BLOCK NODES
   ========================================================================= */

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | FigureNode
  | TableNode
  | EquationNode
  | QuoteNode
  | ListNode
  | PageBreakNode
  | SceneBreakNode;

export interface ParagraphNode {
  type: 'paragraph';
  id: string;
  content: InlineNode[];
  styleOverride?: ParagraphStyleOverride;
}

export interface ParagraphStyleOverride {
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  firstLineIndentMm?: number;
}

export interface HeadingNode {
  type: 'heading';
  id: string; // UUID required for cross-references
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: InlineNode[];
  numberingMode: 'auto' | 'none'; // 'none' for unnumbered sections (e.g. "ВВЕДЕНИЕ")
}

export interface FigureNode {
  type: 'figure';
  id: string; // UUID for cross-references
  mediaUrl: string;
  captionContent: InlineNode[]; // Caption text without hardcoded numbers
  numberingMode: 'global' | 'by_chapter' | 'none';
  alignment: 'center' | 'left' | 'right';
  width?: string | number;
}

export interface TableNode {
  type: 'table';
  id: string; // UUID for cross-references
  captionContent: InlineNode[];
  numberingMode: 'global' | 'by_chapter' | 'none';
  repeatHeaderOnPageBreak: boolean;
  keepWithCaption: boolean;
  columnWidths?: number[];
  rows: TableRowNode[];
}

export interface TableRowNode {
  id: string;
  isHeader?: boolean;
  cells: TableCellNode[];
}

export interface TableCellNode {
  id: string;
  content: BlockNode[];
  colSpan?: number;
  rowSpan?: number;
  alignment?: 'left' | 'center' | 'right';
}

export interface EquationNode {
  type: 'equation';
  id: string; // UUID for cross-references
  latex: string;
  numberingMode: 'auto' | 'none';
}

export interface QuoteNode {
  type: 'quote';
  id: string;
  content: BlockNode[];
  citationAuthor?: string;
}

export interface ListNode {
  type: 'list';
  id: string;
  variant: 'bullet' | 'ordered';
  items: ListItemNode[];
}

export interface ListItemNode {
  id: string;
  content: BlockNode[];
}

export interface PageBreakNode {
  type: 'page_break';
  id: string;
}

export interface SceneBreakNode {
  type: 'scene_break';
  id: string;
  variant: 'asterisms' | 'line' | 'space';
}

/* =========================================================================
   INLINE NODES
   ========================================================================= */

export type InlineNode =
  | TextNode
  | MathInlineNode
  | CrossReferenceNode
  | FootnoteReferenceNode
  | EntityReferenceNode;

export interface EntityReferenceNode {
  type: 'entity_reference';
  id: string;
  entityType: string;
  name: string;
  url?: string;
}

export interface TextNode {
  type: 'text';
  text: string;
  marks?: TextMark[];
}

export type TextMark =
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

export interface MathInlineNode {
  type: 'math_inline';
  latex: string;
}

export interface FootnoteReferenceNode {
  type: 'footnote_reference';
  id: string; // Footnote UUID
  content: InlineNode[]; // Structured footnote content (not raw HTML string)
}

export interface CrossReferenceNode {
  type: 'cross_reference';
  targetId: string; // UUID of Heading, Figure, Table, Equation
  kind: 'heading' | 'figure' | 'table' | 'equation' | 'page';
  displayMode: 'full' | 'short' | 'number_only';
}
