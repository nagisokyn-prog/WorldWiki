export type PageSize = 'A4' | 'A5' | 'A3' | 'Letter' | 'B5';
export type Orientation = 'portrait' | 'landscape';

export interface MarginsMm {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface WordSelectionDTO {
  empty: boolean;
  blockId?: string;
  isInsideTable: boolean;
  firstLineIndentCm?: number;
  leftIndentCm?: number;
  rightIndentCm?: number;
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
  headingLevel?: number;
  isBlockquote?: boolean;
  isBulletList?: boolean;
  isOrderedList?: boolean;
}

export interface WordLayoutDTO {
  pageSize: PageSize;
  orientation: Orientation;
  marginsMm: MarginsMm;
}

export interface WordHeaderFooterDTO {
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

export interface WordStatsDTO {
  pageCount: number;
  wordCount: number;
  characterCount: number;
}
