import type { DocumentProfile } from './types';

/**
 * 1. Academic GOST Profile (ГОСТ 7.32-2017 / ГОСТ Р 7.0.5-2008)
 * Standard for Russian university coursework, thesis, and scientific papers.
 */
export const AcademicGOSTProfile: DocumentProfile = {
  id: 'gost_academic',
  name: 'Академический ГОСТ',
  description: 'ГОСТ 7.32 (А4, поля 30/20/10/20 мм, Times New Roman 14pt, 1.5 интервал, красная строка 12.5 мм, Justify)',
  page: {
    format: 'A4',
    orientation: 'portrait',
    margins: {
      leftMm: 30, // ГОСТ: под подшивку 30 мм
      rightMm: 10,
      topMm: 20,
      bottomMm: 20
    }
  },
  typography: {
    fontFamily: 'Times New Roman',
    baseSizePt: 14,
    textColor: '#000000'
  },
  paragraph: {
    lineHeight: 1.5,
    firstLineIndentMm: 12.5, // ГОСТ: строго 1.25 см
    alignment: 'justify',
    spaceAfterPt: 0
  },
  headings: {
    fontFamily: 'Times New Roman',
    levels: {
      1: { sizePt: 16, bold: true, alignment: 'center', pageBreakBefore: true, spaceBeforePt: 12, spaceAfterPt: 12 },
      2: { sizePt: 14, bold: true, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 12, spaceAfterPt: 6 },
      3: { sizePt: 14, bold: true, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 6, spaceAfterPt: 4 },
      4: { sizePt: 14, bold: false, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 4, spaceAfterPt: 2 }
    }
  },
  numbering: {
    figureMode: 'global',
    tableMode: 'global',
    equationMode: 'global',
    footnoteRestartPerPage: false,
    headingNumberingEnabled: true,
    figurePrefix: 'Рисунок',
    tablePrefix: 'Таблица',
    equationFormat: 'parens'
  },
  figures: {
    captionAlignment: 'center',
    captionSizePt: 12,
    spaceBeforePt: 12,
    spaceAfterPt: 12
  },
  tables: {
    captionAlignment: 'left',
    captionSizePt: 12,
    repeatHeaderOnPageBreak: true,
    fontSizePt: 12
  },
  footnotes: {
    fontSizePt: 10,
    lineHeight: 1.0,
    separatorLine: true
  },
  headersFooters: {
    showPageNumber: true,
    pageNumberPosition: 'top-right', // ГОСТ: вверху по центру или справа
    firstPageExcluded: true          // Титульник без номера
  },
  exportProfiles: {
    docx: { format: 'docx', includeCover: true, embedFonts: true },
    pdf: { format: 'pdf', includeCover: true, embedFonts: true },
    epub: { format: 'epub', includeCover: false, embedFonts: false },
    fb2: { format: 'fb2', includeCover: false, embedFonts: false }
  }
};

/**
 * 2. Novel / Book Profile (А5 / B5)
 * Standard layout for fiction literature and paperbacks.
 */
export const NovelBookProfile: DocumentProfile = {
  id: 'novel_book',
  name: 'Художественная книга (А5)',
  description: 'Книжная верстка (формат А5, гарнитура Georgia, отступ 8 мм, разделители сцен, нижний колонтитул)',
  page: {
    format: 'A5',
    orientation: 'portrait',
    margins: {
      leftMm: 18,
      rightMm: 14,
      topMm: 16,
      bottomMm: 18
    }
  },
  typography: {
    fontFamily: 'Georgia',
    baseSizePt: 11,
    textColor: '#1a1a1a'
  },
  paragraph: {
    lineHeight: 1.35,
    firstLineIndentMm: 8.0,
    alignment: 'justify',
    spaceAfterPt: 0
  },
  headings: {
    fontFamily: 'Georgia',
    levels: {
      1: { sizePt: 18, bold: true, alignment: 'center', pageBreakBefore: true, spaceBeforePt: 36, spaceAfterPt: 24 },
      2: { sizePt: 14, bold: true, alignment: 'center', pageBreakBefore: false, spaceBeforePt: 18, spaceAfterPt: 12 },
      3: { sizePt: 12, bold: true, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 12, spaceAfterPt: 6 },
      4: { sizePt: 11, bold: false, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 6, spaceAfterPt: 4 }
    }
  },
  numbering: {
    figureMode: 'global',
    tableMode: 'global',
    equationMode: 'global',
    footnoteRestartPerPage: true,
    headingNumberingEnabled: false, // In fiction chapters are titled "Глава 1" or named directly
    figurePrefix: 'Илл.',
    tablePrefix: 'Таблица',
    equationFormat: 'plain'
  },
  figures: {
    captionAlignment: 'center',
    captionSizePt: 10,
    spaceBeforePt: 8,
    spaceAfterPt: 8
  },
  tables: {
    captionAlignment: 'center',
    captionSizePt: 10,
    repeatHeaderOnPageBreak: false,
    fontSizePt: 10
  },
  footnotes: {
    fontSizePt: 9,
    lineHeight: 1.1,
    separatorLine: true
  },
  headersFooters: {
    showPageNumber: true,
    pageNumberPosition: 'bottom-center',
    firstPageExcluded: true
  },
  exportProfiles: {
    docx: { format: 'docx', includeCover: true, embedFonts: true },
    pdf: { format: 'pdf', includeCover: true, embedFonts: true },
    epub: { format: 'epub', includeCover: true, embedFonts: true },
    fb2: { format: 'fb2', includeCover: true, embedFonts: false }
  }
};

/**
 * 3. Continuous Draft Canvas Profile
 * Screen-optimized profile for distraction-free draft writing without physical pages.
 */
export const ContinuousDraftProfile: DocumentProfile = {
  id: 'continuous_draft',
  name: 'Свободный черновик',
  description: 'Потоковый экранный холст без разрывов страниц (Inter, 12pt, удобные отступы)',
  page: {
    format: 'Custom',
    orientation: 'portrait',
    margins: {
      leftMm: 0,
      rightMm: 0,
      topMm: 0,
      bottomMm: 0
    }
  },
  typography: {
    fontFamily: 'Inter',
    baseSizePt: 12,
    textColor: 'var(--text-primary, #e2e8f0)'
  },
  paragraph: {
    lineHeight: 1.5,
    firstLineIndentMm: 0,
    alignment: 'left',
    spaceAfterPt: 8
  },
  headings: {
    fontFamily: 'Inter',
    levels: {
      1: { sizePt: 22, bold: true, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 24, spaceAfterPt: 12 },
      2: { sizePt: 18, bold: true, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 18, spaceAfterPt: 8 },
      3: { sizePt: 15, bold: true, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 12, spaceAfterPt: 6 },
      4: { sizePt: 13, bold: true, alignment: 'left', pageBreakBefore: false, spaceBeforePt: 8, spaceAfterPt: 4 }
    }
  },
  numbering: {
    figureMode: 'global',
    tableMode: 'global',
    equationMode: 'global',
    footnoteRestartPerPage: false,
    headingNumberingEnabled: false,
    figurePrefix: 'Рис.',
    tablePrefix: 'Табл.',
    equationFormat: 'parens'
  },
  figures: {
    captionAlignment: 'center',
    captionSizePt: 11,
    spaceBeforePt: 6,
    spaceAfterPt: 6
  },
  tables: {
    captionAlignment: 'left',
    captionSizePt: 11,
    repeatHeaderOnPageBreak: false,
    fontSizePt: 11
  },
  footnotes: {
    fontSizePt: 10,
    lineHeight: 1.2,
    separatorLine: true
  },
  headersFooters: {
    showPageNumber: false,
    pageNumberPosition: 'none',
    firstPageExcluded: true
  },
  exportProfiles: {
    docx: { format: 'docx', includeCover: false, embedFonts: false },
    pdf: { format: 'pdf', includeCover: false, embedFonts: false },
    epub: { format: 'epub', includeCover: false, embedFonts: false },
    fb2: { format: 'fb2', includeCover: false, embedFonts: false }
  }
};

export const DEFAULT_PROFILES: Record<string, DocumentProfile> = {
  gost_academic: AcademicGOSTProfile,
  novel_book: NovelBookProfile,
  continuous_draft: ContinuousDraftProfile
};
