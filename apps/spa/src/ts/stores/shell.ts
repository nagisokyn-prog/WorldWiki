/**
 * @file shell.ts
 * @description Pinia store для главного окна приложения (UI state + навигация + бизнес-логика)
 * 
 * Мигрирует из useAppShell.ts:
 * - State: activeView, currentSidebarTab, showSettings, sidebarSearch, activePanelTab, consoleLogs, activeField, panelHeight, sidebarWidth, splitLeftWidth, activeTreeNode, sidebarVisible, settings, isCreatingEntity
 * - Computed: openEditors, activeEditorId, activeEditor, activeEntityRawId, activeSidebarItem, filteredEntityList, unsavedCount, zoomLevel
 * - Methods: selectSidebarTab, openEntity, openSchemaEditor, openChapterTab, closeEditor, markUnsaved, markSaved, saveAll, closeAllTabs, addNewEntity, toggleSettings, resetSettings, handleUpdateData, deleteEntity, renameEntity, renameChapter, createChapterIn, deleteChapter, deleteVolume, deleteArc, applyZoom, selectTreeNode, handleScrollChange, handleSectionChange, openQuickOpen, openTagsManager, openFloatingEditor, onChapterRenamed, toggleEntityHistory, openSandbox, splitRight, closeGroup, moveTab, reorderTab, activateTabInGroup, focusGroup
 * - Infrastructure: startResize, startSidebarResize, startSplitResize, startGroupResize, quickOpenDataSource, handleQuickOpenSelect, openQuickOpen, getEntityDisplayName
 */
import { defineStore } from 'pinia';
import { ref, computed, watch, shallowRef, triggerRef } from 'vue';
import { useEditorGroups, settingsService, type AppSettings } from '@worldwiki/components';
import * as api from '../services/api.client';
import type { Chapter } from '../types/generated/Chapter';
import type { Entity } from '../types/generated/Entity';
import { useSchemaStore } from './schema';
import { useConsoleStore } from './console';
import { useZoomStore } from './zoom';
import { useFloatingStore } from './floating';
import { entityApi } from '../services/Entity/entity.api';


export interface SidebarItem {
  type: 'static' | 'entity' | 'chapters';
  url?: string;
  entityType?: string;
  icon: string;
  emoji: string;
  title: string;
}

export interface ConsoleLog {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

export interface EditorTab {
  id: string;
  rawId: string;
  title: string;
  entityType: string;
  tabType: 'entity' | 'chapter' | 'schema-editor';
  data: Record<string, unknown>;
  unsaved: boolean;
  scrollPos?: number;
  activeSection?: string;
  _foreignUpdates?: Record<string, unknown>;
}

export interface EditorGroup {
  id: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  flexBasis: number;
}

export interface QuickOpenItem {
  id: string;
  rawId: string;
  title: string;
  typeLabel: string;
  entityType: string;
  emoji: string;
  data: Record<string, unknown>;
}

export const useShellStore = defineStore('shell', () => {
  // ─── Editor Groups ─────────────────────────
  const eg = useEditorGroups();

  // ─── Stores dependencies ─────────────────────────
  const schema = useSchemaStore();
  const consoleMod = useConsoleStore();
  const zoom = useZoomStore();
  const floating = useFloatingStore();

  // ─── State ─────────────────────────
  const activeView = ref<'entity' | 'chapters' | 'static' | 'sandbox'>('entity');
  const currentSidebarTab = ref<string | null>(null);
  const showSettings = ref(false);
  const sidebarSearch = ref('');
  const activePanelTab = ref('');
  const consoleLogs = shallowRef<ConsoleLog[]>([]);
  const activeField = ref('name');
  const panelHeight = ref(parseInt(localStorage.getItem('app-panel-height') || '150'));
  const sidebarWidth = ref(parseInt(localStorage.getItem('app-sidebar-width') || '280'));
  const splitLeftWidth = ref(parseFloat(localStorage.getItem('app-split-width') || '50'));
  const activeTreeNode = ref<{ type: string; node: { id?: string; [key: string]: unknown } } | null>(null);
  const sidebarVisible = ref(true);
  const quickOpenRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const commandPaletteRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const tagsManagerRef = ref<{ open: () => void; close?: () => void } | null>(null);
  const settings = ref<AppSettings>(settingsService.getSettings());
  
  // Реактивная синхронизация настроек с состоянием шелла
  settingsService.onChange((s: AppSettings) => {
    settings.value = s;
    if (s.spacing?.sidebarWidth) sidebarWidth.value = s.spacing.sidebarWidth;
    if (s.spacing?.panelHeight) panelHeight.value = s.spacing.panelHeight;
    if (s.layout?.focusMode !== undefined) {
      sidebarVisible.value = !s.layout.focusMode;
    }
  });

  const isCreatingEntity = ref(false);
  const chapterTreeRef = ref<{ load?: (id?: string) => void; refresh?: () => void; [key: string]: unknown } | null>(null);
  const sidebarItems = ref<SidebarItem[]>([]);
  const projectName = ref<string>('default');
  const isWowilonOpen = ref(false);

  // ─── Log ─────────────────────────
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

  // ─── Computed ─────────────────────────
  const openEditors = computed(() => eg.allTabs.value);
  const activeEditorId = computed({
    get: () => eg.activeGroup.value?.activeTabId ?? null,
    set: (id: string | null) => {
      if (id) {
        const g = eg.findGroupByTab(id);
        if (g) { g.activeTabId = id; eg.activeGroupId.value = g.id; }
      }
    },
  });
  const activeEditor = computed(() => eg.activeTab.value);
  const activeEntityRawId = computed(() => activeEditor.value?.rawId || '');

  const activeSidebarItem = computed(() =>
    sidebarItems.value.find(i =>
      i.entityType === currentSidebarTab.value ||
      i.url === currentSidebarTab.value ||
      (i.type === 'chapters' && currentSidebarTab.value === 'chapters')
    ) || null
  );

  const unsavedCount = computed(() => openEditors.value.filter((e) => e.unsaved).length);

  // Entity lists moved from useEntityLists
  const entityLists = shallowRef<Record<string, Array<Record<string, unknown>>>>({});
  const chapters = shallowRef<Array<Chapter>>([]);

  const filteredEntityList = computed(() => {
    const q = sidebarSearch.value.toLowerCase();
    if (currentSidebarTab.value === 'chapters') {
      const list = chapters.value || [];
      return q ? list.filter((c) => String(c.title || '').toLowerCase().includes(q)) : list;
    }
    const list = entityLists.value[currentSidebarTab.value || ''] || [];
    return q ? list.filter((e) => schema.getEntityDisplayName(e as Record<string, unknown>, currentSidebarTab.value || undefined).toLowerCase().includes(q)) : list;
  });

  // ─── Persistence ─────────────────────────
  const getStateKey = () => `worldwiki-state-${projectName.value}`;
  let isRestoring = false;

  const saveState = () => {
    if (isRestoring) return;
    localStorage.setItem(getStateKey(), JSON.stringify({
      activeView: activeView.value,
      currentSidebarTab: currentSidebarTab.value,
      activePanelTab: activePanelTab.value,
      activeTreeNode: activeTreeNode.value,
      editorGroups: eg.serializeState(),
      activeGroupId: eg.activeGroupId.value,
    }));
  };

  watch(
    () => [
      activeView.value,
      currentSidebarTab.value,
      activePanelTab.value,
      activeTreeNode.value,
      eg.activeGroupId.value,
      eg.groups.value.map((g) => ({
        id: g.id,
        activeTabId: g.activeTabId,
        tabsCount: g.tabs.length,
        tabs: g.tabs.map((t) => t.id)
      }))
    ],
    () => saveState(),
    { deep: true }
  );

  const restoreState = async () => {
    const saved = localStorage.getItem(getStateKey());
    if (!saved) return false;
    isRestoring = true;
    try {
      const state = JSON.parse(saved);
      activeView.value = state.activeView || 'entity';
      currentSidebarTab.value = state.currentSidebarTab || null;
      activePanelTab.value = state.activePanelTab !== undefined ? state.activePanelTab : '';
      activeTreeNode.value = state.activeTreeNode || null;

      const rawGroups = state.editorGroups as EditorGroup[] | undefined;
      const rawTabs = state.openTabs as EditorTab[] | undefined;
      const tabSources: EditorTab[] = rawGroups ? rawGroups.flatMap((g) => g.tabs) : (rawTabs || []);

      const loadedTabs = new Map<string, EditorTab>();
      for (const tab of tabSources) {
        if (loadedTabs.has(tab.id)) continue;
        try {
          if (tab.tabType === 'entity') {
            await schema.loadSchema(tab.entityType);
            const detail = await entityApi.getEntity(projectName.value, tab.entityType, tab.rawId);
            loadedTabs.set(tab.id, { ...tab, data: (detail || {}) as Record<string, unknown>, unsaved: false });
          } else if (tab.tabType === 'chapter') {
            const chapter = await api.getChapter(tab.rawId);
            if (chapter) loadedTabs.set(tab.id, { ...tab, data: chapter as unknown as Record<string, unknown>, unsaved: false });
          } else if (tab.tabType === 'schema-editor') {
            loadedTabs.set(tab.id, { ...tab, data: {}, unsaved: false });
          }
        } catch (e) { console.warn(`Failed to restore tab ${tab.id}`, e); }
      }

      if (rawGroups) {
        eg.restoreState(rawGroups as unknown as Parameters<typeof eg.restoreState>[0], loadedTabs as unknown as Parameters<typeof eg.restoreState>[1]);
      } else {
        const group = eg.groups.value[0];
        for (const [, tab] of loadedTabs) group.tabs.push(tab as unknown as typeof group.tabs[0]);
        if (state.activeEditorId && loadedTabs.has(state.activeEditorId)) {
          group.activeTabId = state.activeEditorId;
        } else if (group.tabs.length > 0) {
          group.activeTabId = group.tabs[0].id;
        }
      }

      isRestoring = false;
      return true;
    } catch (e) {
      console.warn('Failed to restore app state', e);
      isRestoring = false;
      return false;
    }
  };

  // ─── Entity/Chapter Lists ─────────────────────────
  const loadEntityList = async (entityType: string) => {
    try {
      await schema.loadSchema(entityType);
      const list = await entityApi.getEntityList(projectName.value, entityType);
      entityLists.value = { ...entityLists.value, [entityType]: list as Array<Record<string, unknown>> };
      addLog(`Data -> Loaded ${list.length} ${entityType}(s)`, 'info');
    } catch (e) {
      addLog(`Data -> Error loading ${entityType}: ${e}`, 'error');
      entityLists.value = { ...entityLists.value, [entityType]: [] };
    }
  };

  const loadChapters = async () => {
    try {
      const list = await api.getChapters('');
      chapters.value = list;
      addLog(`Data -> Loaded ${chapters.value.length} chapter(s)`, 'info');
    } catch (e) {
      addLog(`Data -> Error loading chapters: ${e}`, 'error');
      chapters.value = [];
    }
  };

  // ─── Methods ─────────────────────────
  const selectSidebarTab = (item: SidebarItem) => {
    if (item.type === 'static' && item.url) {
      window.location.href = item.url + (item.url.includes('?') ? '&' : '?') + `project=${encodeURIComponent('')}`;
      return;
    }
    if (item.type === 'chapters') {
      currentSidebarTab.value = 'chapters';
      activeView.value = 'entity';
      addLog('Navigation -> Chapters', 'info');
      return;
    }
    activeView.value = 'entity';
    currentSidebarTab.value = item.entityType || null;
    addLog(`Navigation -> ${item.title}`, 'info');
    if (item.entityType) loadEntityList(item.entityType);
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
          tabType: 'entity', data: detail as Record<string, unknown>, unsaved: false,
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
    showSettings.value = false;
    activeView.value = 'entity';
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
    activeView.value = 'entity';
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

  const toggleSettings = () => { showSettings.value = !showSettings.value; };
  const resetSettings = () => { settingsService.resetSettings(); addLog('Settings -> Reset', 'warn'); };

  const openTagsManager = () => tagsManagerRef.value?.open();

  const toggleEntityHistory = (rawId: string) => {
    document.dispatchEvent(new CustomEvent('ww:toggle-entity-history', { detail: { id: rawId } }));
  };

  const onChapterRenamed = ({ id, title }: { id: string; title: string }) => {
    eg.updateTabData(id, { title });
  };

  let isLiveSyncing = false;
  let liveSyncTimer: ReturnType<typeof setTimeout> | null = null;

  const handleUpdateData = (tabId: string, newData: Record<string, unknown>, fromLiveSync = false) => {
    const tabsToUpdate = eg.allTabs.value.filter((t) => t.id === tabId || t.rawId === tabId.replace('entities:', ''));
    if (tabsToUpdate.length === 0) return;
    const merge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
      for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          merge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
        } else if (Array.isArray(source[key])) {
          if (!Array.isArray(target[key])) target[key] = [];
          const targetArr = target[key] as unknown[];
          const sourceArr = source[key] as unknown[];
          for (let i = 0; i < sourceArr.length; i++) {
            if (i < targetArr.length) {
              if (typeof sourceArr[i] === 'object' && sourceArr[i] !== null) merge(targetArr[i] as Record<string, unknown>, sourceArr[i] as Record<string, unknown>);
              else targetArr[i] = sourceArr[i];
            } else {
              targetArr.push(sourceArr[i]);
            }
          }
          targetArr.length = sourceArr.length;
        } else {
          target[key] = source[key];
        }
      }
    };
    
    let updatedEntityType: string | null = null;
    let updatedRawId: string | null = null;

    for (const tab of tabsToUpdate) {
      const { __foreignUpdates, ...dataToMerge } = newData as Record<string, unknown> & { __foreignUpdates?: Record<string, unknown> };
      const oldTitle = tab.title;
      merge(tab.data, dataToMerge);
      if (__foreignUpdates && Object.keys(__foreignUpdates).length > 0) (tab as EditorTab)._foreignUpdates = __foreignUpdates;

      const newTitle = schema.getEntityDisplayName(tab.data as Record<string, unknown>, tab.entityType);
      if (newTitle && newTitle !== oldTitle) {
        tab.title = newTitle;
      }
      
      updatedEntityType = tab.entityType;
      updatedRawId = tab.rawId;
    }
    
    if (!fromLiveSync && !isLiveSyncing && updatedEntityType && updatedRawId) {
      if (liveSyncTimer) clearTimeout(liveSyncTimer);
      liveSyncTimer = setTimeout(async () => {
        try {
          console.log('[LiveSync] Emitting ww-entity-live-sync from shell', { type: updatedEntityType, id: updatedRawId });
          const { emit } = await import('@tauri-apps/api/event');
          await emit('ww-entity-live-sync', { type: updatedEntityType, id: updatedRawId, data: newData });
        } catch(e) {
          console.error('[LiveSync] Error emitting from shell', e);
        }
      }, 150);
    }
  };

  // ─── Resizers (from useResizers) ─────────────────────────
  const startResize = (e: MouseEvent) => {
    const startY = e.clientY;
    const startH = panelHeight.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      panelHeight.value = Math.max(80, Math.min(600, startH - (ev.clientY - startY)));
      localStorage.setItem('app-panel-height', panelHeight.value.toString());
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startSidebarResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startW = sidebarWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      const isReverse = settings.value.layout?.sidebarPos === 'row-reverse';
      const delta = isReverse ? (startX - ev.clientX) : (ev.clientX - startX);
      sidebarWidth.value = Math.max(180, Math.min(600, startW + delta));
      localStorage.setItem('app-sidebar-width', sidebarWidth.value.toString());
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startSplitResize = (_e: MouseEvent) => {
    const container = document.getElementById('shellMainSplit');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      splitLeftWidth.value = Math.max(20, Math.min(80, pct));
      localStorage.setItem('app-split-width', splitLeftWidth.value.toString());
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startGroupResize = (e: MouseEvent, index: number) => {
    const left = eg.groups.value[index];
    const right = eg.groups.value[index + 1];
    if (!left || !right) return;

    const startX = e.clientX;
    const container = (e.currentTarget as HTMLElement).closest('.editor-groups-container');
    const totalW = container ? container.getBoundingClientRect().width : window.innerWidth;
    const startLeftPct = left.flexBasis;
    const startRightPct = right.flexBasis;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    const onMove = (ev: MouseEvent) => {
      const deltaPct = ((ev.clientX - startX) / totalW) * 100;
      const newLeft = Math.max(15, Math.min(85, startLeftPct + deltaPct));
      const newRight = Math.max(15, Math.min(85, startRightPct - deltaPct));
      if (newLeft + newRight > 100 || newLeft < 15 || newRight < 15) return;
      left.flexBasis = newLeft;
      right.flexBasis = newRight;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveState();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ─── QuickOpen (from useQuickOpen) ─────────────────────────
  const quickOpenDataSource = async (): Promise<QuickOpenItem[]> => {
    const items: QuickOpenItem[] = [];
    try {
      const list = await api.getChapters('');
      for (const c of list) {
        items.push({ id: `chapter_${c.id}`, rawId: String(c.id), title: c.title || `Глава ${c.id}`, typeLabel: 'Глава', entityType: 'chapter', emoji: '📝', data: c as unknown as Record<string, unknown> });
      }
    } catch { /* skip */ }
    for (const tab of sidebarItems.value) {
      if (tab.type === 'entity' && tab.entityType) {
        try {
          const list = await api.getEntities(projectName.value, tab.entityType);
          for (const e of list) {
            items.push({ id: `entity_${tab.entityType}_${e.id}`, rawId: String(e.id), title: schema.getEntityDisplayName(e as Record<string, unknown>, tab.entityType), typeLabel: tab.title, entityType: tab.entityType, emoji: tab.icon || '📄', data: { ...e, entityType: tab.entityType } as Record<string, unknown> });
          }
        } catch { /* skip */ }
      }
    }
    return items;
  };

  const handleQuickOpenSelect = (item: QuickOpenItem) => {
    if (item.entityType === 'chapter') openChapterTab(item.data as unknown as Chapter);
    else openEntity(item.data);
  };

  const openQuickOpen = () => quickOpenRef.value?.open?.();

  // ─── SaveManager (from useSaveManager) ─────────────────────────
  const saveAll = async () => {
    let savedCount = 0;
    for (const editor of openEditors.value) {
      if (!editor.unsaved) continue;
      if (editor.tabType === 'chapter') {
        document.dispatchEvent(new CustomEvent('ww:trigger-chapter-save'));
        continue;
      }
      if (editor.tabType === 'schema-editor') {
        document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', { detail: { entityType: editor.entityType } }));
        editor.unsaved = false;
        markSaved(editor.id);
        triggerRef(openEditors);
        continue;
      }
      try {

        const prepareEntityForSave = async (_t: string, d: Record<string, unknown>) => d;
        const dataToSave = editor.data as Record<string, unknown> & { __foreignUpdates?: Record<string, unknown> };
        await prepareEntityForSave(editor.entityType, dataToSave);
        const foreignUpdatesToProcess = (editor as EditorTab)._foreignUpdates;
        (editor as EditorTab)._foreignUpdates = undefined;
        delete dataToSave.__foreignUpdates;

        const foreignUpdatesFinal = foreignUpdatesToProcess || {};
        try {
          const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
          if (configRes.ok) {
            const schemaConfig = await configRes.json();
            const oldStateReq = await entityApi.getEntity(projectName.value, editor.entityType, editor.rawId);
            const oldState = oldStateReq as Record<string, unknown> | null;
            if (oldState) {
              for (const section of (schemaConfig.sections as Array<{ dynamicContainers?: Array<{ template: string; dataPath?: string; id: string }> }>) || []) {
                for (const dc of section.dynamicContainers || []) {
                  const tpl = (schemaConfig.templates as Record<string, { isBidirectional?: boolean; bidirectionalLinkClass?: string; fields?: Array<{ class?: string; entityType?: string }> }>)?.[dc.template];
                  if (tpl && tpl.isBidirectional) {
                    const dataPath = dc.dataPath || dc.id;
                    const linkClass = tpl.bidirectionalLinkClass;
                    let targetType = '';
                    if (tpl.fields) {
                      const targetField = tpl.fields.find((f) => f.class === linkClass);
                      if (targetField && targetField.entityType) targetType = targetField.entityType;
                    }
                    if (linkClass && targetType) {
                      const oldArr: Array<Record<string, unknown>> = Array.isArray(oldState[dataPath]) ? (oldState[dataPath] as Array<Record<string, unknown>>) : (Array.isArray(oldState[dc.id]) ? (oldState[dc.id] as Array<Record<string, unknown>>) : []);
                      const newArr: Array<Record<string, unknown>> = Array.isArray(dataToSave[dataPath]) ? (dataToSave[dataPath] as Array<Record<string, unknown>>) : (Array.isArray(dataToSave[dc.id]) ? (dataToSave[dc.id] as Array<Record<string, unknown>>) : []);
                      for (const oldItem of oldArr) {
                        const oldTarget = String(oldItem[linkClass] || '');
                        if (!oldTarget) continue;
                        const stillExists = newArr.some((newItem) => String(newItem[linkClass]) === oldTarget);
                        if (!stillExists) {
                          const targetEntityId = oldTarget;
                          const updateKey = `${targetType}:${targetEntityId}_delete`;
                          foreignUpdatesFinal[updateKey] = {
                            entityType: targetType,
                            entityId: targetEntityId,
                            data: {},
                            linkClass,
                            backLinkValue: `entities:${editor.rawId}`,
                            __deleted: true,
                          };
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('[saveAll] Error scanning deleted relationships:', e);
        }
        const modifiedForeignEntities: Entity[] = [];
        const entityId = editor.rawId ? (editor.rawId.startsWith('entities:') ? editor.rawId : `entities:${editor.rawId}`) : `entities:${editor.entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mainPayload = entityApi.formatEntityPayload(projectName.value, editor.entityType, dataToSave, entityId, editor.title || 'Новая сущность');
        
        const savedEntity = await api.saveEntityWithRelations(projectName.value, mainPayload as unknown as Entity, modifiedForeignEntities);
        if (savedEntity && savedEntity.id) {
          editor.rawId = savedEntity.id.replace('entities:', '');
        }

        const newTitle = schema.getEntityDisplayName(editor.data as Record<string, unknown>, editor.entityType);
        if (newTitle && newTitle !== editor.title) {
          editor.title = newTitle;
        }
        if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
        if (currentSidebarTab.value === editor.entityType) loadEntityList(currentSidebarTab.value as string);
        editor.unsaved = false;
        markSaved(editor.id);
        triggerRef(openEditors);
        try {
          const { emit } = await import('@tauri-apps/api/event');
          await emit('ww-entity-saved', { type: editor.entityType, id: `entities:${editor.rawId}` });
        } catch (e) {
          console.warn('Tauri emit ww-entity-saved failed', e);
        }
        savedCount++;
      } catch (e) {
        addLog(`Save -> Error: ${e}`, 'error');
      }
    }
    if (savedCount > 0) {
      document.dispatchEvent(new CustomEvent('ww:entity-saved'));
      addToast(`Успешно сохранено: ${savedCount}`, 'success');
      addLog(`System -> Saved ${savedCount} items`, 'success');
    }
  };

  // ─── EntityOps (from useEntityOps) ─────────────────────────
  const deleteEntity = async (tabId: string, entityType: string, silent = false) => {
    if (!silent) {
        const confirmed = await new Promise<boolean>(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);animation:fadeIn 0.2s;';
            const modal = document.createElement('div');
            modal.style.cssText = 'background:var(--bg-panel, #1e1e1e);border:1px solid var(--border-color, #333);border-radius:12px;padding:32px;max-width:400px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.5);color:var(--text-main, #eee);';
            modal.innerHTML = `
                <div style="font-size:32px;margin-bottom:16px;">🗑️</div>
                <h3 style="margin:0 0 12px 0;font-weight:900;">Удаление записи</h3>
                <p style="opacity:0.7;font-size:14px;margin-bottom:24px;line-height:1.5;">Вы уверены, что хотите безвозвратно удалить эту запись?</p>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button id="cancel-btn" style="padding:10px 20px;border-radius:8px;border:none;background:rgba(255,255,255,0.1);color:var(--text-main, #eee);cursor:pointer;font-weight:bold;transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">Отмена</button>
                    <button id="confirm-btn" style="padding:10px 20px;border-radius:8px;border:none;background:#ff5555;color:#fff;cursor:pointer;font-weight:bold;transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Удалить</button>
                </div>
            `;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            modal.querySelector('#cancel-btn')!.addEventListener('click', () => { document.body.removeChild(overlay); resolve(false); });
            modal.querySelector('#confirm-btn')!.addEventListener('click', () => { document.body.removeChild(overlay); resolve(true); });
        });
        if (!confirmed) return;
    }
    const colonIdx = tabId.indexOf(':');
    const rawId = colonIdx > -1 ? tabId.slice(colonIdx + 1) : tabId;
    
    console.log(`[shell.ts deleteEntity] tabId: "${tabId}", rawId: "${rawId}", entityType: "${entityType}"`);
    
    try {
      console.log(`[shell.ts deleteEntity] Calling api.deleteEntity("${rawId}")`);
      await api.deleteEntity(rawId);
      console.log(`[shell.ts deleteEntity] Successfully called api.deleteEntity`);
      
      closeEditor(tabId, true);
      if (activeTreeNode.value && activeTreeNode.value.type === entityType && activeTreeNode.value.node.id === rawId) {
        activeTreeNode.value = null;
      }
      if (currentSidebarTab.value) await loadEntityList(currentSidebarTab.value);
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
      addToast(`Запись удалена`, 'warn');
    } catch (e) {
      console.error(`[shell.ts deleteEntity] ERROR:`, e);
      addLog(`Entity -> Delete error: ${e}`, 'error');
      const { appAlert } = await import('@worldwiki/components');
      appAlert(`Ошибка при удалении сущности: ${e}`);
    }
  };

  const renameEntity = async (entityType: string, idToUpdate: string, newName: string) => {
    console.log('[renameEntity] called with:', { entityType, idToUpdate, newName });
    try {
      const detail = await entityApi.getEntity(projectName.value, entityType, idToUpdate) as Record<string, unknown> | null;
      console.log('[renameEntity] detail from server:', detail);
      
      // Use schema's titleField if available, fallback to detection
      const sch = await schema.loadSchema(entityType);
      const schemaTitleField = sch?.titleField || (sch?.sections?.[0]?.fields as Array<{ isTitle?: boolean; path?: string }> | undefined)?.find((f: { isTitle?: boolean; path?: string }) => f.isTitle)?.path;
      const titleField = schemaTitleField || (detail ? (Object.keys(detail).find(k => k.toLowerCase() === 'name') || Object.keys(detail)[0]) : 'name');
      console.log('[renameEntity] titleField:', titleField, 'from schema:', schemaTitleField);
      
      if (titleField && detail) {
        detail[titleField] = newName;
        await entityApi.saveEntity(projectName.value, entityType, detail, idToUpdate, newName);
        
        // Try both tab ID formats
        const actualTabId = eg.findTabGlobal(idToUpdate) ? idToUpdate : null;
        console.log('[renameEntity] actualTabId found:', actualTabId);
        
        if (actualTabId) {
          eg.updateTabData(actualTabId, { title: newName });
          // Use handleUpdateData to properly update tab.data and trigger reactivity
          handleUpdateData(actualTabId, { [titleField]: newName });
        } else {
          console.warn('[renameEntity] Could not find tab');
        }
        
        console.log('[renameEntity] allTabs after update:', openEditors.value.map((t) => ({ id: t.id, title: t.title, data: t.data })));
        
        // Refresh tree and entity list
        if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
        if (currentSidebarTab.value === entityType) await loadEntityList(entityType);
        
        // Dispatch with the full rawId (with prefix) so EntityEditor can match by props.entityId
        document.dispatchEvent(new CustomEvent('ww:entity-renamed', { 
          detail: { id: idToUpdate, type: entityType, name: newName } 
        }));
        console.log('[renameEntity] dispatched ww:entity-renamed with id:', idToUpdate);
      }
    } catch(e) {
      console.error('[renameEntity] Error:', e);
      addLog(`Error renaming entity: ${e}`, 'error');
    }
  };

  const addNewEntity = async (entityType: string, preDefinedName?: string) => {
    if (!entityType || isCreatingEntity.value) return;
    isCreatingEntity.value = true;
    try {
      if (entityType === 'chapters') {
        const newChapterTitle = preDefinedName || prompt('Введите название новой главы:', 'Новая глава');
        if (newChapterTitle === null) return;
        const newChapter: Chapter = {
          id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          project_id: `projects:${projectName.value}`,
          title: newChapterTitle || 'Новая глава', content: '# Начните писать\n\n',
          summary: undefined,
          word_count: 0 as unknown as bigint,
          embeddings: {},
          footnotes: {},
          timeline_events: [],
          participants: [],
          arc_id: null,
          volume_id: null,
        } as unknown as Chapter;
        await api.saveChapter(projectName.value, newChapter);
        addLog(`Chapter -> Created [${newChapter.title}]`, 'success');
        addToast(`Глава "${newChapter.title}" создана`, 'success');
        chapters.value.push(newChapter);
        triggerRef(chapters);
        if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
        openChapterTab(newChapter);
        return;
      }

      const sch = await schema.loadSchema(entityType);
      const titleFieldPath: string = sch?.titleField || sch?.sections?.[0]?.fields?.[0]?.path || 'name';
      const initialData: Record<string, unknown> = {};
      const nameToSet = preDefinedName || prompt(`Введите название для нового элемента:`, 'Без названия');
      if (nameToSet === null) return;
      if (nameToSet) {
        const parts = titleFieldPath.split('.');
        let current = initialData;
        for (let i = 0; i < parts.length - 1; i++) { current[parts[i]] = {}; current = current[parts[i]] as Record<string, unknown>; }
        current[parts[parts.length - 1]] = nameToSet;
      }

      const saveResult = await entityApi.saveEntity(projectName.value, entityType, initialData, undefined, nameToSet);
      const newEntityId = saveResult.id;
      if (!newEntityId) {
        addLog(`Entity -> Error: не удалось сохранить сущность`, 'error');
        return;
      }

      const newEntity = await entityApi.getEntity(projectName.value, entityType, newEntityId as string);
      if (!newEntity) { 
        addLog(`Entity -> Error: не удалось загрузить только что созданную сущность`, 'error');
        return;
      }
      
      addLog(`Entity -> Created`, 'success');
      await loadEntityList(entityType);
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load();

      const entityToOpen = { ...(newEntity as Record<string, unknown>), entityType };
      openEntity(entityToOpen);
    } catch (e) {
      addLog(`Entity -> Error: ${e}`, 'error');
    } finally {
      isCreatingEntity.value = false;
    }
  };

  // ─── ChapterOps (from useChapterOps) ─────────────────────────
  let isCreatingChapter = false;

  const createChapterIn = async ({ arcId, volumeId }: { arcId?: string; volumeId?: string } = {}) => {
    if (isCreatingChapter) return;
    isCreatingChapter = true;
    try {
      const hierarchy = await api.getChapterHierarchy(projectName.value);
      const allChapters = hierarchy.chapters || [];
      let maxNum = 0;
      let relevantCount = 0;
      if (Array.isArray(allChapters)) {
        const relevantChapters = allChapters.filter((c) => {
          const cArcId = c.arc_id ? String(c.arc_id) : null;
          const cVolId = c.volume_id ? String(c.volume_id) : null;
          const targetArcId = arcId ? String(arcId) : null;
          const targetVolId = volumeId ? String(volumeId) : null;
          if (targetArcId) return cArcId === targetArcId;
          if (targetVolId) return cVolId === targetVolId && !cArcId;
          return !cArcId && !cVolId;
        });
        relevantCount = relevantChapters.length;
        relevantChapters.forEach((c) => {
          const m = (c.title || '').match(/Глава\s*(\d+)/i);
          if (m) {
            const n = parseInt(m[1]);
            if (n > maxNum) maxNum = n;
          }
        });
      }
      const num = maxNum + 1;
      addLog(`Manuscript -> Next chapter number: ${num} (found ${relevantCount} in this section)`, 'info');
      const newCh: Chapter = {
        id: `chapters:chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        project_id: `projects:${projectName.value}`,
        title: `Глава ${num}`,
        content: '# Новая глава\n\n',
        summary: undefined,
        word_count: 0 as unknown as bigint,
        embeddings: {},
        footnotes: {},
        timeline_events: [],
        participants: [],
        arc_id: arcId || null,
        volume_id: volumeId || null,
      } as unknown as Chapter;
      const saveRes = await api.saveChapter(projectName.value, newCh);
      if (saveRes && saveRes.id) newCh.id = saveRes.id;
      if ((arcId || volumeId) && newCh.id) await api.assignChapter(projectName.value, newCh.id, arcId || null, volumeId || null);
      addLog('Manuscript -> Created new chapter', 'success');
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load(newCh.id || undefined);
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      if (chapters.value) {
        chapters.value = [...chapters.value, newCh];
      }
      openChapterTab(newCh);
    } catch (e) {
      addLog(`Manuscript -> Error creating chapter: ${e}`, 'error');
    } finally {
      isCreatingChapter = false;
    }
  };

  const deleteChapter = async (chapter: { id?: string | null; title?: string }, _silent = false) => {
    if (!chapter.id) return;
    try {
      await api.deleteChapter(chapter.id);
      addLog(`Manuscript -> Deleted chapter ${chapter.title || chapter.id}`, 'success');
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      closeEditor(chapter.id);
    } catch (e) {
      addLog(`Manuscript -> Error deleting chapter: ${e}`, 'error');
    }
  };

  const renameChapter = async (chapter: { id?: string | null }, newTitle: string) => {
    if (!chapter.id) return;
    try {
      const targetId = chapter.id;
      chapters.value = chapters.value.map((c) => c.id === targetId ? { ...c, title: newTitle } : c);
      const fullData = await api.getChapter(targetId);
      if (fullData) {
        fullData.title = newTitle;
        await api.saveChapter(projectName.value, fullData);
      }
      addLog(`Chapter renamed: ${newTitle}`, 'success');
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    } catch (e) {
      console.error('Failed to rename chapter:', e);
      addLog(`Error renaming chapter: ${e}`, 'error');
    }
  };

  const compareIds = (id1: unknown, id2: unknown) => {
    if (!id1 && !id2) return true;
    if (!id1 || !id2) return false;
    const s1 = typeof id1 === 'object' && id1 !== null && 'id' in id1 ? String((id1 as { id: unknown }).id) : String(id1);
    const s2 = typeof id2 === 'object' && id2 !== null && 'id' in id2 ? String((id2 as { id: unknown }).id) : String(id2);
    return s1.split(':').pop() === s2.split(':').pop();
  };

  const closeEditorsFor = (predicate: (e: EditorTab) => boolean) => {
    for (const ed of openEditors.value.filter(predicate)) {
      closeEditor(ed.id, true);
      if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ed.id) {
        activeTreeNode.value = null;
      }
    }
  };

  const deleteVolume = async (volume: { id: string; title?: string; [key: string]: unknown }, chaptersInVol: Array<{ id: string }> = [], arcsInVol: string[] = [], silent: boolean = false) => {
    const { appConfirm } = await import('@worldwiki/components');
    if (!silent && !await appConfirm(`Удалить том "${volume.title}" и все его содержимое?`)) return;
    try {
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.volume_id, volume.id) ||
          arcsInVol.some(arcId => compareIds(e.data.arc_id, arcId)) ||
          chaptersInVol.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInVol) {
        try { await api.deleteChapter(ch.id); } catch (err) { console.error('Ошибка удаления главы (vol):', err); }
        closeEditor(String(ch.id), true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
          activeTreeNode.value = null;
        }
      }
      for (const arcId of arcsInVol) {
        await api.deleteArc(arcId);
        if (activeTreeNode.value && activeTreeNode.value.type === 'arc' && activeTreeNode.value.node.id === arcId) {
          activeTreeNode.value = null;
        }
      }
      await api.deleteVolume(volume.id);
      addLog(`Deleted volume [${volume.id}]`, 'warn');
      if (activeTreeNode.value && activeTreeNode.value.type === 'volume' && activeTreeNode.value.node.id === volume.id) {
        activeTreeNode.value = null;
      }
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
      addToast(`Том "${volume.title}" удален`, 'warn');
      if (currentSidebarTab.value === 'chapters') loadEntityList('chapters');
    } catch (e) {
      addLog(`Error deleting volume: ${e}`, 'error');
    }
  };

  const deleteArc = async (arc: { id: string; title?: string; [key: string]: unknown }, chaptersInArc: Array<{ id: string }> = [], silent: boolean = false) => {
    const { appConfirm } = await import('@worldwiki/components');
    if (!silent && !await appConfirm(`Удалить арку "${arc.title}" и все ее главы?`)) return;
    try {
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.arcId, arc.id) ||
          chaptersInArc.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInArc) {
        try { await api.deleteChapter(ch.id); } catch (err) { console.error('Ошибка удаления главы (arc):', err); }
        closeEditor(String(ch.id), true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
          activeTreeNode.value = null;
        }
      }
      await api.deleteArc(arc.id);
      addLog(`Deleted arc [${arc.id}]`, 'warn');
      if (activeTreeNode.value && activeTreeNode.value.type === 'arc' && activeTreeNode.value.node.id === arc.id) {
        activeTreeNode.value = null;
      }
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
      addToast(`Арка "${arc.title}" удалена`, 'warn');
      if (currentSidebarTab.value === 'chapters') loadEntityList('chapters');
    } catch (e) {
      addLog(`Error deleting arc: ${e}`, 'error');
    }
  };

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
        
        if (currentSidebarTab.value === type) loadEntityList(type);
        if (type === 'chapter' && chapterTreeRef.value?.load) chapterTreeRef.value.load();
      })?.catch?.(() => {});
      
      listen<{ type: string; id: string; data: Record<string, unknown> }>('ww-entity-live-sync', (event) => {
        const { type, id, data } = event.payload;
        const rawId = id.replace('entities:', '');
        
        eg.groups.value.forEach((group) => {
          group.tabs.forEach((tab) => {
            if (tab.entityType === type && (tab.rawId === rawId || tab.id === rawId)) {
              console.log('[LiveSync] Received in shell', data);
              isLiveSyncing = true;
              handleUpdateData(tab.id, data, true);
              setTimeout(() => { isLiveSyncing = false; }, 50);
            }
          });
        });
      })?.catch?.(() => {});
    }).catch(() => {});
  }

  return {
    // State
    projectName,
    activeView,
    currentSidebarTab,
    showSettings,
    sidebarSearch,
    activePanelTab,
    consoleLogs,
    activeField,
    panelHeight,
    sidebarWidth,
    splitLeftWidth,
    activeTreeNode,
    sidebarVisible,
    quickOpenRef,
    commandPaletteRef,
    tagsManagerRef,
    settings,
    isCreatingEntity,
    chapterTreeRef,
    sidebarItems,
    // Entity Lists
    entityLists,
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
    // Methods
    addLog,
    addToast,
    getToastIcon,
    applyZoom,
    saveState,
    restoreState,
    loadEntityList,
    loadChapters,
    selectSidebarTab,
    openEntity,
    openSchemaEditor,
    openChapterTab,
    closeEditor,
    closeAllTabs,
    markUnsaved,
    markSaved,
    toggleSettings,
    resetSettings,
    handleUpdateData,
    deleteEntity,
    renameEntity,
    renameChapter,
    createChapterIn,
    deleteChapter,
    deleteVolume,
    deleteArc,
    toggleEntityHistory,
    onChapterRenamed,
    selectTreeNode: (node: { type: string; node: { id?: string; [key: string]: unknown } } | null) => { activeTreeNode.value = node; },
    handleScrollChange: (groupId: string, tabId: string, scroll: number) => {
      const group = eg.groups.value.find((g) => g.id === groupId);
      const tab = group?.tabs.find((t) => t.id === tabId);
      if (tab) { (tab as EditorTab).scrollPos = scroll; saveState(); }
    },
    handleSectionChange: (groupId: string, tabId: string, sectionId: string) => {
      const group = eg.groups.value.find((g) => g.id === groupId);
      const tab = group?.tabs.find((t) => t.id === tabId);
      if (tab) {
        (tab as EditorTab).activeSection = sectionId;
        saveState();
      }
    },
    openQuickOpen,
    openTagsManager,
    openFloatingEditor: (project: string, entityType: string, entityId: string) => floating.openFloatingEditor(project, entityType, entityId),
    openSandbox: () => { openSchemaEditor('universal'); },
    splitRight: () => eg.splitRight(),
    closeGroup: (gid: string) => eg.removeGroup(gid),
    moveTab: (p: { tabId: string; toGroupId: string; toIndex: number }) => eg.moveTab(p.tabId, p.toGroupId, p.toIndex),
    reorderTab: (p: { groupId: string; fromIdx: number; toIdx: number }) => eg.reorderTab(p.groupId, p.fromIdx, p.toIdx),
    activateTabInGroup: (gid: string, tid: string) => {
      const g = eg.groups.value.find((gr) => gr.id === gid);
      if (g) { g.activeTabId = tid; eg.activeGroupId.value = gid; }
    },
    focusGroup: (gid: string) => { eg.activeGroupId.value = gid; },
    // Resizers
    startResize,
    startSidebarResize,
    startSplitResize,
    startGroupResize,
    // QuickOpen
    quickOpenDataSource,
    handleQuickOpenSelect,
    // SaveManager
    saveAll,
    // EntityOps
    addNewEntity,
    
    isWowilonOpen,
  };
});
