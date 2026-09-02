/**
 * Публичный контракт команд Word-ленты.
 *
 * Этот файл — ЕДИНСТВЕННОЕ место, где описан интерфейс команд ленты.
 * Реализация (RibbonCommands) живёт внутри адаптера word-vibe; приложение
 * получает доступ к командам ТОЛЬКО через adapter.execCommand(name, ...args).
 */

export type PaperSize = 'A4' | 'A5' | 'A3' | 'Letter' | 'B5';

export interface RibbonCommands {
  toggleBold?: () => boolean | undefined;
  toggleItalic?: () => boolean | undefined;
  toggleUnderline?: () => boolean | undefined;
  toggleStrike?: () => boolean | undefined;
  toggleSubscript?: () => boolean | undefined;
  toggleSuperscript?: () => boolean | undefined;
  toggleHighlight?: () => boolean | undefined;
  setHeading?: (level: number) => boolean | undefined;
  toggleBlockquote?: () => boolean | undefined;
  toggleBulletList?: () => boolean | undefined;
  toggleOrderedList?: () => boolean | undefined;
  setTextAlign?: (align: 'left' | 'center' | 'right' | 'justify') => void | boolean | undefined;
  setFontFamily?: (font: string) => void | boolean | undefined;
  setFontSize?: (size: string) => void | boolean | undefined;
  setLineHeight?: (height: string) => void | boolean | undefined;
  decreaseIndent?: () => void | boolean | undefined;
  increaseIndent?: () => void | boolean | undefined;
  insertPageBreak?: () => void;
  insertImage?: () => void;
  insertImageWithCaption?: (src: string, caption?: string) => void;
  insertTable?: () => void;
  insertTableWithCaption?: (rows: number, cols: number, title?: string) => void;
  insertLink?: () => void;
  insertLinkUrl?: (url: string) => void;
  insertFootnote?: () => void;
  insertEquation?: () => void;
  insertEquationLatex?: (latex: string) => void;
  clearFormatting?: () => void;
  setGostMargins?: () => void;
  setMarginPreset?: (preset: 'gost' | 'normal' | 'narrow' | 'wide') => void;
  setCustomMargins?: (top: number, bottom: number, left: number, right: number) => void;
  setParagraphSpacing?: (beforePt: number, afterPt: number) => void;
  setLeftIndentCm?: (cm: number) => void;
  setRightIndentCm?: (cm: number) => void;
  insertSectionBreak?: () => void;
  insertSectionPortrait?: () => void;
  insertSectionLandscape?: () => void;
  updateHeaderText?: (left: string, right: string) => void;
  updateFooterText?: (left: string, right: string) => void;
  openHeaderFooterDialog?: (tab?: 'header' | 'footer') => void;
  openPageSetup?: () => void;
  insertTextBox?: () => void;
  insertTableOfContents?: () => void;
  togglePageOrientation?: () => void;
  setPageSize?: (size: PaperSize) => void;
  [key: string]: unknown;
}
