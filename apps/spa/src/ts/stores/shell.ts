/**
 * @file shell.ts
 * @description Фасад Pinia store для главного окна приложения
 * Координирует специализированные подсистемы: layout, persistence, manuscript, entityOps, quickOpen
 */

import { defineStore } from 'pinia';
import { ref, computed, watch, shallowRef, triggerRef } from 'vue';
import { useEditorGroups } from '@worldwiki/components';
import * as api from '../services/api.client';
import { entityApi } from '../services/Entity/entity.api';
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

  // ─── 2. Жизненный цикл вкладок ─────────────────────────
  const closeEditor = async (id: string, force = false) => {
    await eg.closeTab(id, force);
    addLog(`Editor -> Closed [${id}]`, 'warn');
  };

  const closeAllTabs = async () => await eg.closeAll();

  const markUnsaved = (tabId?: string) => {
    const id = tabId ?? activeEditor.value?.id;
    if (id) eg.markTabUnsaved(id);
  };

  const markSaved = (tabId?: string) => {
    const id = tabId ?? activeEditor.value?.id;
    if (id) { eg.markTabSaved(id); addToast('Глава сохранена', 'success'); }
  };

  const openEntity = async (entity: { id?: string | number; entityType?: string; entity_type?: string; Name?: string; name?: string; title?: string; [key: string]: unknown }) => {
    const entityType = entity.entityType || entity.entity_type;
    if (!entityType) return;
    if (!entity.id || entity.id === 'undefined') {
      addLog(`Editor -> Error: попытка открыть сущность без ID (${entityType})`, 'error');
      return;
    }
    const rawId = String(entity.id);
    const tabId = `entity:${entityType}:${rawId}`;
    if (!eg.findTabGlobal(tabId)) {
      try {
        await schema.loadSchema(entityType);
        const detail = await entityApi.getEntity(projectName.value, entityType, rawId);
        const tabTitle = entity.Name || entity.name || entity.title || schema.getEntityDisplayName(detail as Record<string, unknown>, entityType);
        eg.openTab({
          id: tabId, rawId, title: tabTitle, entityType,
          tabType: 'entity', data: (detail || {}) as Record<string, unknown>, unsaved: false,
        });
        addLog(`Editor -> Opened ${entityType} [${tabTitle}]`, 'info');
      } catch (e) {
        addLog(`Editor -> Error opening: ${e}`, 'error');
        return;
      }
    } else {
      const g = eg.findGroupByTab(tabId);
      if (g) { g.activeTabId = tabId; eg.activeGroupId.value = g.id; }
    }
    layout.showSettings.value = false;
    layout.activeView.value = 'entity';
  };

  const openChapterTab = (chapter: Chapter | { id?: string | number; title?: string; [key: string]: unknown }) => {
    const id = String(chapter.id);
    if (!eg.findTabGlobal(id)) {
      eg.openTab({
        id, rawId: id, title: chapter.title || `Глава ${id}`,
        entityType: 'chapter', tabType: 'chapter', data: chapter as Record<string, unknown>, unsaved: false,
      });
    } else {
      const g = eg.findGroupByTab(id);
      if (g) { g.activeTabId = id; eg.activeGroupId.value = g.id; }
    }
    layout.activeView.value = 'entity';
    addLog(`Editor -> Chapter [${chapter.title}]`, 'info');
  };

  const openSchemaEditor = async (entityType: string) => {
    if (!entityType) return;
    const tabId = `schema-editor:${entityType}`;
    if (!eg.findTabGlobal(tabId)) {
      eg.openTab({
        id: tabId, rawId: entityType, title: `Схема: ${entityType}`, entityType,
        tabType: 'schema-editor', data: {}, unsaved: false,
      });
      addLog(`Editor -> Opened Schema Editor for ${entityType}`, 'info');
    } else {
      const g = eg.findGroupByTab(tabId);
      if (g) { g.activeTabId = tabId; eg.activeGroupId.value = g.id; }
    }
  };

  // ─── 3. Подсистема EntityOps ─────────────────────────
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
    closeEditor,
    markSaved,
    openEntity,
    openChapterTab
  });

  // ─── 4. Подсистема Manuscript ─────────────────────────
  const manuscript = useShellManuscript({
    projectName,
    chapters,
    chapterTreeRef,
    activeTreeNode,
    currentSidebarTab: layout.currentSidebarTab,
    openEditors,
    addLog,
    addToast,
    openChapterTab,
    closeEditor,
    loadEntityList: entityOps.loadEntityList,
    updateTabData: (tabId, data) => eg.updateTabData(tabId, data)
  });

  // ─── 5. Подсистема QuickOpen ─────────────────────────
  const quickOpen = useShellQuickOpen({
    projectName,
    sidebarItems,
    schema,
    openChapterTab,
    openEntity
  });

  // ─── 6. Подсистема Persistence ─────────────────────────
  const persistence = useShellPersistence({
    projectName,
    activeView: layout.activeView,
    currentSidebarTab: layout.currentSidebarTab,
    activePanelTab: layout.activePanelTab,
    activeTreeNode,
    eg,
    schema
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

  const selectSidebarTab = (item: SidebarItem) => {
    if (item.type === 'static' && item.url) {
      window.location.href = item.url + (item.url.includes('?') ? '&' : '?') + `project=${encodeURIComponent('')}`;
      return;
    }
    if (item.type === 'chapters') {
      layout.currentSidebarTab.value = 'chapters';
      layout.activeView.value = 'entity';
      addLog('Navigation -> Chapters', 'info');
      return;
    }
    layout.activeView.value = 'entity';
    layout.currentSidebarTab.value = item.entityType || null;
    addLog(`Navigation -> ${item.title}`, 'info');
    if (item.entityType) entityOps.loadEntityList(item.entityType);
  };

  // ─── Обработчики скролла и секций с защитным дебаунсом ─────────────────────────
  const handleScrollChange = (groupId: string, tabId: string, scroll: number) => {
    const group = eg.groups.value.find((g) => g.id === groupId);
    const tab = group?.tabs.find((t) => t.id === tabId);
    if (tab) {
      (tab as EditorTab).scrollPos = scroll;
      persistence.debouncedSaveState(1000);
    }
  };

  const handleSectionChange = (groupId: string, tabId: string, sectionId: string) => {
    const group = eg.groups.value.find((g) => g.id === groupId);
    const tab = group?.tabs.find((t) => t.id === tabId);
    if (tab) {
      (tab as EditorTab).activeSection = sectionId;
      persistence.debouncedSaveState(500);
    }
  };

  // ─── Слушатели системных событий Tauri ─────────────────────────
  if (typeof window !== 'undefined' && window.__TAURI__) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ type: string; id: string }>('ww-entity-saved', (event) => {
        const { type, id } = event.payload;
        const rawId = id.replace('entities:', '');

        eg.groups.value.forEach((group) => {
          group.tabs.forEach((tab) => {
            if (tab.entityType === type && (tab.rawId === rawId || tab.id === rawId)) {
              if (type === 'chapter') {
                api.getChapter(tab.rawId).then((data) => {
                  if (data) {
                    tab.data = data as unknown as Record<string, unknown>;
                  }
                });
              } else if (type !== 'schema-editor') {
                entityApi.getEntity(projectName.value, type, tab.rawId).then((data) => {
                  if (data) {
                    tab.data = data as Record<string, unknown>;
                  }
                });
              }
            }
          });
        });

        if (layout.currentSidebarTab.value === type) entityOps.loadEntityList(type);
        if (type === 'chapter' && chapterTreeRef.value?.load) chapterTreeRef.value.load();
      })?.catch?.(() => {});

      listen<{ type: string; id: string; data: Record<string, unknown> }>('ww-entity-live-sync', (event) => {
        const { type, id, data } = event.payload;
        const rawId = id.replace('entities:', '');

        eg.groups.value.forEach((group) => {
          group.tabs.forEach((tab) => {
            if (tab.entityType === type && (tab.rawId === rawId || tab.id === rawId)) {
              console.log('[LiveSync] Received in shell', data);
              entityOps.setIsLiveSyncing(true);
              entityOps.handleUpdateData(tab.id, data, true);
              setTimeout(() => { entityOps.setIsLiveSyncing(false); }, 50);
            }
          });
        });
      })?.catch?.(() => {});
    }).catch(() => {});
  }

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
    selectSidebarTab,
    openEntity,
    openSchemaEditor,
    openChapterTab,
    closeEditor,
    closeAllTabs,
    markUnsaved,
    markSaved,
    handleScrollChange,
    handleSectionChange,
    openSandbox: () => { openSchemaEditor('universal'); },
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
    deleteChapter: manuscript.deleteChapter,
    renameChapter: manuscript.renameChapter,
    deleteVolume: manuscript.deleteVolume,
    deleteArc: manuscript.deleteArc,
    onChapterRenamed: manuscript.onChapterRenamed,

    // Entity Ops
    loadEntityList: entityOps.loadEntityList,
    handleUpdateData: entityOps.handleUpdateData,
    deleteEntity: entityOps.deleteEntity,
    renameEntity: entityOps.renameEntity,
    addNewEntity: entityOps.addNewEntity,
    toggleEntityHistory: entityOps.toggleEntityHistory,
    saveAll: entityOps.saveAll,

    // QuickOpen & Modals
    openQuickOpen: quickOpen.openQuickOpen,
    openTagsManager: quickOpen.openTagsManager,
    quickOpenDataSource: quickOpen.quickOpenDataSource,
    handleQuickOpenSelect: quickOpen.handleQuickOpenSelect,

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
