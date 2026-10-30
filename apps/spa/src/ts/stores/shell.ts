/**
 * @file shell.ts
 * @description Фасад Pinia store для главного окна приложения
 * Координирует специализированные подсистемы: layout, persistence, manuscript, entityOps, quickOpen, navigation, events
 */

import { defineStore } from 'pinia';
import { ref, computed, watch, shallowRef, triggerRef } from 'vue';
import { useEditorGroups } from '@worldwiki/components';
import type { Chapter } from '../types/generated/Chapter';
import { useSchemaStore } from './schema';
import { useConsoleStore } from './console';
import { useZoomStore } from './zoom';
import { useFloatingStore } from './floating';

// Подсистемы шелла
import { useShellLayout } from './shell/shell.layout';
import { useShellPersistence } from './shell/shell.persistence';
import { useShellManuscript } from './shell/shell.manuscript';
import { useShellQuickOpen } from './shell/shell.quickopen';
import { useShellEntityOps } from './shell/shell.entityOps';
import { useShellNavigation } from './shell/shell.navigation';
import { setupShellTauriEvents } from './shell/shell.events';

// Реэкспорт общих типов для полной обратной совместимости
export * from './shell/shell.types';
import type { SidebarItem, ConsoleLog, EditorTab, EditorGroup } from './shell/shell.types';

export const useShellStore = defineStore('shell', () => {
  // ─── Редакторские группы и связанные сторы ─────────────────────────
  const eg = useEditorGroups();
  const schema = useSchemaStore();
  const consoleMod = useConsoleStore();
  const zoom = useZoomStore();
  const floating = useFloatingStore();

  // ─── Базовое состояние ─────────────────────────
  const projectName = ref<string>('default');
  const consoleLogs = shallowRef<ConsoleLog[]>([]);
  const activeTreeNode = ref<{ type: string; node: { id?: string; [key: string]: unknown } } | null>(null);
  const chapterTreeRef = ref<{ load?: (id?: string) => Promise<void>; refresh?: () => void; [key: string]: unknown } | null>(null);
  const sidebarItems = ref<SidebarItem[]>([]);
  const chapters = shallowRef<Array<Chapter>>([]);

  // ─── Логирование и тосты ─────────────────────────
  let logCounter = 0;
  const addLog = (text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const logs = consoleLogs.value;
    logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
    if (logs.length > 100) logs.splice(100);
    triggerRef(consoleLogs);
  };

  const addToast = consoleMod.addToast;
  const getToastIcon = consoleMod.getToastIcon;
  const zoomLevel = zoom.zoomLevel;
  const applyZoom = zoom.applyZoom;

  // ─── 1. Подсистема Layout ─────────────────────────
  const layout = useShellLayout({
    getEditorGroups: () => eg.groups.value as unknown as EditorGroup[],
    onGroupResizeEnd: () => persistence.saveState()
  });

  // ─── Вычисляемые свойства вкладок ─────────────────────────
  const openEditors = computed(() => eg.allTabs.value as unknown as EditorTab[]);
  const activeEditorId = computed({
    get: () => eg.activeGroup.value?.activeTabId ?? null,
    set: (id: string | null) => {
      if (id) {
        const g = eg.findGroupByTab(id);
        if (g) { g.activeTabId = id; eg.activeGroupId.value = g.id; }
      }
    },
  });
  const activeEditor = computed(() => eg.activeTab.value as unknown as EditorTab | null);
  const activeEntityRawId = computed(() => activeEditor.value?.rawId || '');

  const activeSidebarItem = computed(() =>
    sidebarItems.value.find(i =>
      i.entityType === layout.currentSidebarTab.value ||
      i.url === layout.currentSidebarTab.value ||
      (i.type === 'chapters' && layout.currentSidebarTab.value === 'chapters')
    ) || null
  );

  const unsavedCount = computed(() => openEditors.value.filter((e) => e.unsaved).length);

  // ─── 2. Подсистема Persistence ─────────────────────────
  const persistence = useShellPersistence({
    projectName,
    activeView: layout.activeView,
    currentSidebarTab: layout.currentSidebarTab,
    activePanelTab: layout.activePanelTab,
    activeTreeNode,
    eg,
    schema
  });

  // ─── 3. Подсистема Navigation ─────────────────────────
  const navigation = useShellNavigation({
    eg,
    projectName,
    schema,
    layout,
    persistence,
    activeEditor,
    addLog,
    addToast,
    loadEntityList: (entityType: string) => entityOps.loadEntityList(entityType)
  });

  // ─── 4. Подсистема EntityOps ─────────────────────────
  const entityOps = useShellEntityOps({
    projectName,
    eg,
    openEditors,
    schema,
    activeEditor,
    activeTreeNode,
    currentSidebarTab: layout.currentSidebarTab,
    chapterTreeRef,
    chapters,
    addLog,
    addToast,
    closeEditor: navigation.closeEditor,
    markSaved: navigation.markSaved,
    openEntity: navigation.openEntity,
    openChapterTab: navigation.openChapterTab
  });

  // ─── 5. Подсистема Manuscript ─────────────────────────
  const manuscript = useShellManuscript({
    projectName,
    chapters,
    chapterTreeRef,
    activeTreeNode,
    currentSidebarTab: layout.currentSidebarTab,
    openEditors,
    addLog,
    addToast,
    openChapterTab: navigation.openChapterTab,
    closeEditor: navigation.closeEditor,
    loadEntityList: entityOps.loadEntityList,
    updateTabData: (tabId, data) => eg.updateTabData(tabId, data)
  });

  // ─── 6. Подсистема QuickOpen ─────────────────────────
  const quickOpen = useShellQuickOpen({
    projectName,
    sidebarItems,
    schema,
    openChapterTab: navigation.openChapterTab,
    openEntity: navigation.openEntity,
    setActivePanelTab: (tab: string) => { layout.activePanelTab.value = tab; }
  });

  // Синхронизация состояния приложения в localStorage при изменениях
  watch(
    () => [
      layout.activeView.value,
      layout.currentSidebarTab.value,
      layout.activePanelTab.value,
      activeTreeNode.value,
      eg.activeGroupId.value,
      eg.groups.value.map((g) => ({
        id: g.id,
        activeTabId: g.activeTabId,
        tabsCount: g.tabs.length,
        tabs: g.tabs.map((t) => t.id)
      }))
    ],
    () => persistence.debouncedSaveState(300),
    { deep: true }
  );

  // ─── Фильтрация сущностей для сайдбара ─────────────────────────
  const filteredEntityList = computed(() => {
    const q = layout.sidebarSearch.value.toLowerCase();
    if (layout.currentSidebarTab.value === 'chapters') {
      const list = chapters.value || [];
      return q ? list.filter((c) => String(c.title || '').toLowerCase().includes(q)) : list;
    }
    const list = entityOps.entityLists.value[layout.currentSidebarTab.value || ''] || [];
    return q ? list.filter((e) => schema.getEntityDisplayName(e as Record<string, unknown>, layout.currentSidebarTab.value || undefined).toLowerCase().includes(q)) : list;
  });

  // ─── Слушатели системных событий Tauri ─────────────────────────
  setupShellTauriEvents({
    eg,
    projectName,
    layout,
    entityOps,
    chapterTreeRef
  });

  // ─── Возвращаемый интерфейс стора (100% обратная совместимость) ─────────────────────────
  return {
    // State
    projectName,
    activeView: layout.activeView,
    currentSidebarTab: layout.currentSidebarTab,
    showSettings: layout.showSettings,
    sidebarSearch: layout.sidebarSearch,
    activePanelTab: layout.activePanelTab,
    consoleLogs,
    activeField: layout.activeField,
    panelHeight: layout.panelHeight,
    sidebarWidth: layout.sidebarWidth,
    splitLeftWidth: layout.splitLeftWidth,
    activeTreeNode,
    sidebarVisible: layout.sidebarVisible,
    quickOpenRef: quickOpen.quickOpenRef,
    commandPaletteRef: quickOpen.commandPaletteRef,
    tagsManagerRef: quickOpen.tagsManagerRef,
    settings: layout.settings,
    isCreatingEntity: entityOps.isCreatingEntity,
    chapterTreeRef,
    sidebarItems,
    isWowilonOpen: layout.isWowilonOpen,

    // Entity & Chapter Lists
    entityLists: entityOps.entityLists,
    chapters,

    // Computed
    openEditors,
    activeEditorId,
    activeEditor,
    activeEntityRawId,
    activeSidebarItem,
    filteredEntityList,
    unsavedCount,
    zoomLevel,

    // Editor Groups API
    editorGroups: eg.groups,
    activeGroupId: eg.activeGroupId,

    // Logging & Toasts & Zoom
    addLog,
    addToast,
    getToastIcon,
    applyZoom,

    // Persistence
    saveState: persistence.saveState,
    restoreState: persistence.restoreState,

    // Navigation & Tabs
    selectSidebarTab: navigation.selectSidebarTab,
    openEntity: navigation.openEntity,
    openSchemaEditor: navigation.openSchemaEditor,
    openChapterTab: navigation.openChapterTab,
    closeEditor: navigation.closeEditor,
    closeAllTabs: navigation.closeAllTabs,
    markUnsaved: navigation.markUnsaved,
    markSaved: navigation.markSaved,
    handleScrollChange: navigation.handleScrollChange,
    handleSectionChange: navigation.handleSectionChange,
    openSandbox: () => { navigation.openSchemaEditor('universal'); },
    openFloatingEditor: (project: string, entityType: string, entityId: string) => floating.openFloatingEditor(project, entityType, entityId),

    // Layout & Resizers
    toggleSettings: layout.toggleSettings,
    resetSettings: layout.resetSettings,
    startResize: layout.startResize,
    startSidebarResize: layout.startSidebarResize,
    startSplitResize: layout.startSplitResize,
    startGroupResize: layout.startGroupResize,

    // Manuscript Ops
    loadChapters: manuscript.loadChapters,
    createChapterIn: manuscript.createChapterIn,
    openCreateChapterModal: manuscript.openCreateChapterModal,
    closeCreateChapterModal: manuscript.closeCreateChapterModal,
    confirmCreateChapter: manuscript.confirmCreateChapter,
    isCreateChapterModalOpen: manuscript.isCreateChapterModalOpen,
    createChapterTargetVolumeId: manuscript.createChapterTargetVolumeId,
    deleteChapter: manuscript.deleteChapter,
    renameChapter: manuscript.renameChapter,
    deleteVolume: manuscript.deleteVolume,
    onChapterRenamed: manuscript.onChapterRenamed,

    // Entity Ops
    loadEntityList: entityOps.loadEntityList,
    handleUpdateData: entityOps.handleUpdateData,
    deleteEntity: entityOps.deleteEntity,
    renameEntity: entityOps.renameEntity,
    addNewEntity: entityOps.addNewEntity,
    isCreateEntityModalOpen: entityOps.isCreateEntityModalOpen,
    createEntityTargetType: entityOps.createEntityTargetType,
    openCreateEntityModal: entityOps.openCreateEntityModal,
    closeCreateEntityModal: entityOps.closeCreateEntityModal,
    confirmCreateEntity: entityOps.confirmCreateEntity,
    toggleEntityHistory: entityOps.toggleEntityHistory,
    saveAll: entityOps.saveAll,

    // QuickOpen & Modals
    openQuickOpen: quickOpen.openQuickOpen,
    openTagsManager: quickOpen.openTagsManager,
    quickOpenDataSource: quickOpen.quickOpenDataSource,
    handleQuickOpenSelect: quickOpen.handleQuickOpenSelect,
    paletteCommands: quickOpen.paletteCommands,
    updatePaletteCommands: quickOpen.updatePaletteCommands,
    openCommandPalette: quickOpen.openCommandPalette,

    // Groups Navigation
    selectTreeNode: (node: { type: string; node: { id?: string; [key: string]: unknown } } | null) => { activeTreeNode.value = node; },
    splitRight: () => eg.splitRight(),
    closeGroup: (gid: string) => eg.removeGroup(gid),
    moveTab: (p: { tabId: string; toGroupId: string; toIndex: number }) => eg.moveTab(p.tabId, p.toGroupId, p.toIndex),
    reorderTab: (p: { groupId: string; fromIdx: number; toIdx: number }) => eg.reorderTab(p.groupId, p.fromIdx, p.toIdx),
    activateTabInGroup: (gid: string, tid: string) => {
      const g = eg.groups.value.find((gr) => gr.id === gid);
      if (g) { g.activeTabId = tid; eg.activeGroupId.value = gid; }
    },
    focusGroup: (gid: string) => { eg.activeGroupId.value = gid; },
  };
});
