/**
 * @worldwiki/word-vibe — изолированный Word-редактор WorldWiki.
 *
 * Публичный контракт: чистый Vue 3 компонент WordVibeEditor, фабрика адаптера
 * и DTO-типы. Никаких живых ProseMirror / Tiptap / rk-editor-core объектов наружу.
 */

// ── Главный компонент и композабл ────────────────────────────────────────────
export { default as WordVibeEditor } from './components/WordVibeEditor.vue';
export { useWordVibeEditor } from './components/useWordVibeEditor';
export type { WordVibeEditorProps, WordVibeEditorEmits } from './components/WordVibeEditor.model';

// ── Адаптер и контракты ──────────────────────────────────────────────────────
export { createWordVibeAdapter } from './adapter/createWordVibeAdapter';
export type { WordVibeAdapter, WordVibeOptions } from './adapter/WordVibeAdapter';
export type { WordVibeEventMap } from './adapter/events';

// ── DTO и типы ───────────────────────────────────────────────────────────────
export type {
  PageSize,
  Orientation,
  MarginsMm,
  WordSelectionDTO,
  WordLayoutDTO,
  WordHeaderFooterDTO,
  WordStatsDTO,
} from './types/dto';

// ── Геометрия и утилиты ─────────────────────────────────────────────────────
export { MARGIN_PRESETS_MM, normalizeWordContent } from './editor/useRkWordEditor';
export type { MarginPresetName } from './editor/useRkWordEditor';
export { getPageGeometry, GOST_MARGINS_MM, PX_PER_MM } from './editor/geometryHelper';
export type { PaginationGeometry } from './editor/geometryHelper';

// ── Дочерние UI-компоненты и модалки ───────────────────────────────────────
export { default as WordRibbonBar } from './components/ribbon/WordRibbonBar.vue';
export { default as WordRuler } from './components/ruler/WordRuler.vue';
export { default as ParagraphFormatModal } from './components/modals/ParagraphFormatModal/ParagraphFormatModal.vue';
export type { ParagraphFormatData } from './components/modals/ParagraphFormatModal/ParagraphFormatModal.vue';
export type { PaperSize, RibbonCommands } from './ribbon/commands';
