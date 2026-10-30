// Components
export { default as CommandPalette } from './components/Vue/CommandPalette.vue';
export { default as EditorGroupPane } from './components/Vue/EditorGroupPane.vue';
export { default as EditorTabBar } from './components/Vue/EditorTabBar.vue';
export { default as ExplorerTree } from './components/Vue/ExplorerTree.vue';
export { default as FloatingWindow } from './components/Vue/FloatingWindow.vue';
export { default as HistorySidebar } from './components/Vue/HistorySidebar.vue';
export { default as QuickOpen } from './components/Vue/QuickOpen.vue';
export { default as Settings } from './components/Vue/Settings.vue';
export { default as TagsField } from './components/Vue/TagsField.vue';
export { default as ThemeSwitcher } from './components/Vue/ThemeSwitcher.vue';
export { default as TreeNodes } from './components/Vue/TreeNodes.vue';
export { default as WorkspaceLayout } from './components/Vue/WorkspaceLayout.vue';
export { default as XboxWheel } from './components/Vue/XboxWheel.vue';
export { default as AppDialog } from './components/Vue/AppDialog.vue';
export { default as SafeHtml } from './components/Vue/SafeHtml.vue';
export { default as HighlightText } from './components/Vue/HighlightText.vue';

// Types
export type { TreeNodeData, TreeSectionData } from './types';
export type { AppSettings } from './ts/types/settings.js';
export type { PaletteCommand } from './components/Vue/useCommandPalette.js';

// Composables
export { useEditorGroups } from './ts/composables/useEditorGroups.js';
export { useShellApp } from './ts/composables/useShellApp.js';
export { useTreeSelection } from './ts/composables/useTreeSelection.js';
export { useAppDialog, appAlert, appConfirm } from './ts/composables/useAppDialog.js';

// Utils

// I18n
export { i18n, setLocale } from './ts/i18n.js';

// Services
export * from './ts/services/api.service.js';
export { editorService } from './ts/services/editor.service.js';
export { EntityService } from './ts/services/entity.service.js';
export { footnoteService } from './ts/services/footnote.service.js';
export { settingsService } from './ts/services/settings.service.js';
