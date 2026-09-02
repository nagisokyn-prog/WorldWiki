/**
 * @worldwiki/word-vibe — изолированный Word-редактор WorldWiki.
 *
 * Публичный контракт: только функции/типы, никаких живых ProseMirror /
 * rk-editor-core объектов наружу. Vue-компоненты (RibbonBar, Ruler)
 * на переходный период живут в apps/spa и импортируют отсюда логику.
 */

// ── Editor core ─────────────────────────────────────────────────────────────
export { useRkWordEditor, normalizeWordContent, MARGIN_PRESETS_MM } from './editor/useRkWordEditor';
export type { MarginsMm, MarginPresetName } from './editor/useRkWordEditor';

export {
  attachPaginationPlus,
  updatePaginationLayout,
  updatePaginationText,
  readPageCount,
  disableRkBuiltinPagination,
} from './editor/rkPaginationBridge';
export type { PaginationTextOptions } from './editor/rkPaginationBridge';

export { getPageGeometry, GOST_MARGINS_MM, PX_PER_MM } from './editor/geometryHelper';
export type { PaginationGeometry } from './editor/geometryHelper';

export type {
  PageSize,
  Orientation,
  RkWordEditorProps,
  RkWordEditorEmits,
  RkWordEditorState,
  EditorInstance,
} from './editor/RkWordEditor.model';

// ── ГОСТ extensions ─────────────────────────────────────────────────────────
export { insertGostFigureCaption } from './editor/extensions/GostFigureCaption';
export { insertGostTableCaption } from './editor/extensions/GostTableCaption';
export { insertSectionLandscape, insertSectionPortrait } from './editor/extensions/SectionOrientation';

// ── Ribbon commands contract ────────────────────────────────────────────────
export type { PaperSize, RibbonCommands } from './ribbon/commands';
