/**
 * @file stores/index.ts
 * @description Экспорт всех Pinia stores
 */
export { useSettingsStore } from './settings';
export { useConsoleStore } from './console';
export { useZoomStore } from './zoom';
export { useFloatingStore } from './floating';
export { useSchemaStore } from './schema';
export { useShellStore } from './shell';
export { useHotkeysStore } from './hotkeys';

// Re-export types from shell store for external use
export type { SidebarItem, ConsoleLog, EditorGroup, EditorTab } from './shell';
