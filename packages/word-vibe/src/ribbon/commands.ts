/**
 * Публичный контракт команд Word-ленты.
 *
 * Этот файл — ЕДИНСТВЕННОЕ место, где описан интерфейс команд ленты.
 * Реализация (RibbonCommands) живёт внутри адаптера word-vibe; приложение
 * получает доступ к командам ТОЛЬКО через adapter.execCommand(name, ...args).
 */

export type PaperSize = 'A4' | 'A5' | 'A3' | 'Letter' | 'B5';

export interface RibbonCommands {
  toggleBold?: () => boolean | void | undefined;
  toggleItalic?: () => boolean | void | undefined;
  toggleUnderline?: () => boolean | void | undefined;
  toggleStrike?: () => boolean | void | undefined;
  toggleSubscript?: () => boolean | void | undefined;
  toggleSuperscript?: () => boolean | void | undefined;
  toggleHighlight?: (color?: string) => boolean | void | undefined;
  setHeading?: (level: number) => boolean | void | undefined;
  toggleBlockquote?: () => boolean | void | undefined;
  toggleBulletList?: () => boolean | void | undefined;
  toggleOrderedList?: () => boolean | void | undefined;
  setTextAlign?: (align: 'left' | 'center' | 'right' | 'justify') => void | boolean | undefined;
  setFontFamily?: (font: string) => void | boolean | undefined;
  setFontSize?: (size: string) => void | boolean | undefined;
  setLineHeight?: (height: string) => void | boolean | undefined;
  decreaseIndent?: () => void | boolean | undefined;
  increaseIndent?: () => void | boolean | undefined;
  insertPageBreak?: () => void | boolean | undefined;
  insertSceneBreak?: (variant?: 'asterisms' | 'line' | 'space') => void | boolean | undefined;
  insertEntityReference?: (id: string, type?: string, name?: string, url?: string) => void | boolean | undefined;
  insertCrossReference?: (targetId: string, kind?: string, displayMode?: string) => void | boolean | undefined;
  insertImage?: () => void | boolean | undefined;
  insertImageWithCaption?: (src: string, caption?: string) => void | boolean | undefined;
  insertTable?: () => void | boolean | undefined;
  insertTableWithCaption?: (rows: number, cols: number, title?: string) => void | boolean | undefined;
  insertLink?: () => void | boolean | undefined;
  insertLinkUrl?: (url: string) => void | boolean | undefined;
  insertFootnote?: () => void | boolean | undefined;
  insertEquation?: () => void | boolean | undefined;
  insertEquationLatex?: (latex: string) => void | boolean | undefined;
  clearFormatting?: () => void | boolean | undefined;
  setGostMargins?: () => void | boolean | undefined;
  setMarginPreset?: (preset: 'gost' | 'normal' | 'narrow' | 'wide' | string) => void | boolean | undefined;
  setCustomMargins?: (top: number, bottom: number, left: number, right: number) => void | boolean | undefined;
  setParagraphSpacing?: (beforePt: number, afterPt: number) => void | boolean | undefined;
  setLeftIndentCm?: (cm: number) => void | boolean | undefined;
  setRightIndentCm?: (cm: number) => void | boolean | undefined;
  insertSectionBreak?: () => void | boolean | undefined;
  insertSectionPortrait?: () => void | boolean | undefined;
  insertSectionLandscape?: () => void | boolean | undefined;
  updateHeaderText?: (left: string, right: string) => void | boolean | undefined;
  updateFooterText?: (left: string, right: string) => void | boolean | undefined;
  openHeaderFooterDialog?: (tab?: 'header' | 'footer') => void | boolean | undefined;
  openPageSetup?: () => void | boolean | undefined;
  insertTextBox?: () => void | boolean | undefined;
  insertTableOfContents?: (opts?: Record<string, unknown>) => void | boolean | undefined;
  togglePageOrientation?: () => void | boolean | undefined;
  setPageSize?: (size: PaperSize | string) => void | boolean | undefined;
  // Табличные команды
  addRowBefore?: () => void | boolean | undefined;
  addRowAfter?: () => void | boolean | undefined;
  addColumnBefore?: () => void | boolean | undefined;
  addColumnAfter?: () => void | boolean | undefined;
  deleteRow?: () => void | boolean | undefined;
  deleteColumn?: () => void | boolean | undefined;
  deleteTable?: () => void | boolean | undefined;
  mergeCells?: () => void | boolean | undefined;
  splitCell?: () => void | boolean | undefined;
  setTableStyle?: (style: string) => void | boolean | undefined;
  [key: string]: unknown;
}
