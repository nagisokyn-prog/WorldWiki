import type { NumberingProfile } from '../numbering/types';

/**
 * Composite Document & Export Profile Types for WorldWiki.
 * Clean modular decomposition: Page, Typography, Paragraphs, Headings, Numbering, Exporters.
 */

export interface DocumentProfile {
  id: string;
  name: string;
  description: string;
  page: PageProfile;
  typography: TypographyProfile;
  paragraph: ParagraphProfile;
  headings: HeadingProfile;
  numbering: NumberingProfile;
  figures: FigureProfile;
  tables: TableProfile;
  footnotes: FootnoteProfile;
  headersFooters: HeaderFooterProfile;
  exportProfiles: Record<ExportFormat, ExportProfile>;
}

export type ExportFormat = 'docx' | 'pdf' | 'epub' | 'fb2';

export interface PageProfile {
  format: 'A4' | 'A5' | 'B5' | 'Letter' | 'Custom';
  orientation: 'portrait' | 'landscape';
  margins: PageMargins;
}

export interface PageMargins {
  leftMm: number;
  rightMm: number;
  topMm: number;
  bottomMm: number;
}

export interface TypographyProfile {
  fontFamily: string; // e.g. "Times New Roman"
  baseSizePt: number; // e.g. 14
  textColor: string;
}

export interface ParagraphProfile {
  lineHeight: number;        // e.g. 1.5
  firstLineIndentMm: number; // e.g. 12.5 mm for GOST
  alignment: 'justify' | 'left' | 'center' | 'right';
  spaceAfterPt: number;
}

export interface HeadingProfile {
  fontFamily?: string;
  levels: Record<1 | 2 | 3 | 4, HeadingLevelStyle>;
}

export interface HeadingLevelStyle {
  sizePt: number;
  bold: boolean;
  alignment: 'left' | 'center' | 'justify';
  pageBreakBefore: boolean;
  spaceBeforePt: number;
  spaceAfterPt: number;
}

export interface FigureProfile {
  captionAlignment: 'center' | 'left';
  captionSizePt: number;
  spaceBeforePt: number;
  spaceAfterPt: number;
}

export interface TableProfile {
  captionAlignment: 'left' | 'center';
  captionSizePt: number;
  repeatHeaderOnPageBreak: boolean;
  fontSizePt: number;
}

export interface FootnoteProfile {
  fontSizePt: number;
  lineHeight: number;
  separatorLine: boolean;
}

export interface HeaderFooterProfile {
  showPageNumber: boolean;
  pageNumberPosition: 'top-right' | 'top-center' | 'bottom-center' | 'bottom-right' | 'none';
  firstPageExcluded: boolean; // First page (title) has no page number
}

export interface ExportProfile {
  format: ExportFormat;
  includeCover: boolean;
  embedFonts: boolean;
  customOptions?: Record<string, string | number | boolean>;
}
