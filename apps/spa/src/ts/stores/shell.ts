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
import { ref, computed, watch, onMounted, shallowRef, nextTick, triggerRef } from 'vue';
import { useEditorGroups, settingsService, setLocale, i18n } from '@worldwiki/components';
import { apiService } from '@/services/api.service';
import { useSchemaStore } from './schema';
import { useConsoleStore } from './console';
import { useZoomStore } from './zoom';
import { useFloatingStore } from './floating';
import { getValueByPath, setValueByPath } from '@/utils/path';
import { connectionsManager } from '@/services/connections.service';

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
}

export interface EditorGroup {
  id: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  flexBasis: number;
}

export const useShellStore = defineStore('shell', () => {
  // ─── Editor Groups ─────────────────────────
  const eg = useEditorGroups() as any;

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
  const activeTreeNode = ref<{ type: string; node: any } | null>(null);
  const sidebarVisible = ref(true);
  const quickOpenRef = ref<any>(null);
  const commandPaletteRef = ref<any>(null);
  const tagsManagerRef = ref<any>(null);
  const settings = ref<any>(settingsService.getSettings());
  const isCreatingEntity = ref(false);
  const chapterTreeRef = ref<any>(null);
  const sidebarItems = ref<SidebarItem[]>([]);
  const projectName = ref<string>('default');

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

  const unsavedCount = computed(() => openEditors.value.filter((e: any) => e.unsaved).length);

  // Entity lists moved from useEntityLists
  const entityLists = shallowRef<Record<string, Array<Record<string, unknown>>>>({});
  const chapters = shallowRef<Array<any>>([]);

  const filteredEntityList = computed(() => {
    const q = sidebarSearch.value.toLowerCase();
    if (currentSidebarTab.value === 'chapters') {
      const list = chapters.value || [];
      return q ? list.filter((c: any) => String(c.title || '').toLowerCase().includes(q)) : list;
    }
    const list = entityLists.value[currentSidebarTab.value || ''] || [];
    return q ? list.filter((e: any) => schema.getEntityDisplayName(e as Record<string, unknown>, currentSidebarTab.value || undefined).toLowerCase().includes(q)) : list;
  });

  // ─── Persistence ─────────────────────────
  const STATE_KEY = 'worldwiki-state';
  let isRestoring = false;

  const saveState = () => {
    if (isRestoring) return;
    localStorage.setItem(STATE_KEY, JSON.stringify({
      activeView: activeView.value,
      currentSidebarTab: currentSidebarTab.value,
      activePanelTab: activePanelTab.value,
      activeTreeNode: activeTreeNode.value,
      editorGroups: eg.serializeState(),
      activeGroupId: eg.activeGroupId.value,
    }));
  };

  const restoreState = async () => {
    const saved = localStorage.getItem(STATE_KEY);
    if (!saved) return false;
    isRestoring = true;
    try {
      const state = JSON.parse(saved);
      activeView.value = state.activeView || 'entity';
      currentSidebarTab.value = state.currentSidebarTab || null;
      activePanelTab.value = state.activePanelTab !== undefined ? state.activePanelTab : '';
      activeTreeNode.value = state.activeTreeNode || null;

      const rawGroups = state.editorGroups;
      const rawTabs = state.openTabs;
      const tabSources: Array<any> = rawGroups ? rawGroups.flatMap((g: any) => g.tabs) : (rawTabs || []);

      const loadedTabs = new Map<string, any>();
      for (const tab of tabSources) {
        if (loadedTabs.has(tab.id)) continue;
        try {
          if (tab.tabType === 'entity') {
            await schema.loadSchema(tab.entityType);
            const detail = await apiService.getEntity(projectName.value, tab.entityType, tab.rawId);
            loadedTabs.set(tab.id, { ...tab, data: detail, unsaved: false });
          } else if (tab.tabType === 'chapter') {
            const chapter = await apiService.getChapter(projectName.value, tab.rawId);
            if (chapter) loadedTabs.set(tab.id, { ...tab, data: chapter, unsaved: false });
          } else if (tab.tabType === 'schema-editor') {
            loadedTabs.set(tab.id, { ...tab, data: {}, unsaved: false });
          }
        } catch (e) { console.warn(`Failed to restore tab ${tab.id}`, e); }
      }

      if (rawGroups) {
        eg.restoreState(rawGroups, loadedTabs);
      } else {
        const group = eg.groups.value[0];
        for (const [, tab] of loadedTabs) group.tabs.push(tab as any);
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
      const list = await apiService.getEntityList(projectName.value, entityType);
      entityLists.value = { ...entityLists.value, [entityType]: list as Array<Record<string, unknown>> };
      addLog(`Data -> Loaded ${list.length} ${entityType}(s)`, 'info');
    } catch (e) {
      addLog(`Data -> Error loading ${entityType}: ${e}`, 'error');
      entityLists.value = { ...entityLists.value, [entityType]: [] };
    }
  };

  const loadChapters = async () => {
    try {
      const list = await apiService.getChaptersList('');
      chapters.value = list as Array<any>;
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

  const openEntity = async (entity: any) => {
    const entityType = entity.entityType;
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
        const detail = await apiService.getEntity(projectName.value, entityType, rawId);
        const tabTitle = (entity as any).Name || (entity as any).name || (entity as any).title || schema.getEntityDisplayName(detail as Record<string, unknown>, entityType);
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

  const openChapterTab = (chapter: any) => {
    const id = String(chapter.id);
    if (!eg.findTabGlobal(id)) {
      eg.openTab({
        id, rawId: id, title: chapter.title || `Глава ${id}`,
        entityType: 'chapter', tabType: 'chapter', data: chapter, unsaved: false,
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
      eg.openTab({ id: tabId } as any);
    }
  };

  const closeEditor = (id: string, force = false) => {
    eg.closeTab(id, force);
    addLog(`Editor -> Closed [${id}]`, 'warn');
  };

  const closeAllTabs = () => eg.closeAll();

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

  const handleUpdateData = (tabId: string, newData: any) => {
    const tabsToUpdate = eg.allTabs.value.filter((t: any) => t.id === tabId);
    if (tabsToUpdate.length === 0) return;
    const merge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          merge(target[key], source[key]);
        } else if (Array.isArray(source[key])) {
          if (!Array.isArray(target[key])) target[key] = [];
          for (let i = 0; i < source[key].length; i++) {
            if (i < target[key].length) {
              if (typeof source[key][i] === 'object' && source[key][i] !== null) merge(target[key][i], source[key][i]);
              else target[key][i] = source[key][i];
            } else {
              target[key].push(source[key][i]);
            }
          }
          target[key].length = source[key].length;
        } else {
          target[key] = source[key];
        }
      }
    };
    for (const tab of tabsToUpdate) {
      const { __foreignUpdates, ...dataToMerge } = newData as any;
      const oldTitle = tab.title;
      merge(tab.data, dataToMerge);
      if (__foreignUpdates && Object.keys(__foreignUpdates).length > 0) (tab as any)._foreignUpdates = __foreignUpdates;

      const newTitle = schema.getEntityDisplayName(tab.data as Record<string, unknown>, tab.entityType);
      if (newTitle && newTitle !== oldTitle) {
        tab.title = newTitle;
      }
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
      const diff = ev.clientX - startX;
      sidebarWidth.value = Math.max(160, Math.min(520, startW + (isReverse ? -diff : diff)));
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

  const startSplitResize = (e: MouseEvent) => {
    const wrapper = (e.target as HTMLElement).closest('.split-layout-wrapper') as HTMLElement;
    if (!wrapper) return;
    const totalW = wrapper.getBoundingClientRect().width;
    const startX = e.clientX;
    const startPct = splitLeftWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev: MouseEvent) => {
      const pct = Math.max(20, Math.min(80, startPct + ((ev.clientX - startX) / totalW) * 100));
      splitLeftWidth.value = pct;
      wrapper.style.setProperty('--split-left-width', `${pct}%`);
      localStorage.setItem('app-split-width', String(pct));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startGroupResize = (e: MouseEvent, groupIdx: number) => {
    const container = (e.currentTarget as HTMLElement).closest('.editor-groups-container') as HTMLElement;
    if (!container) return;
    const totalW = container.getBoundingClientRect().width;
    const startX = e.clientX;
    const groups = eg.groups.value;
    const left = groups[groupIdx];
    const right = groups[groupIdx + 1];
    if (!left || !right) return;
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
  const quickOpenDataSource = async (): Promise<any[]> => {
    const items: any[] = [];
    try {
      const list = await apiService.getChaptersList('');
      for (const c of list as Array<any>) {
        items.push({ id: `chapter_${c.id}`, rawId: String(c.id), title: c.title || `Глава ${c.id}`, typeLabel: 'Глава', entityType: 'chapter', emoji: '📝', data: c });
      }
    } catch (e) { /* skip */ }
    for (const tab of sidebarItems.value) {
      if (tab.type === 'entity' && tab.entityType) {
        try {
          const list = await apiService.getEntityList(projectName.value, tab.entityType);
          for (const e of list as Array<any>) {
            items.push({ id: `entity_${tab.entityType}_${e.id}`, rawId: String(e.id), title: schema.getEntityDisplayName(e, tab.entityType), typeLabel: tab.title, entityType: tab.entityType, emoji: tab.icon || '📄', data: { ...e, entityType: tab.entityType } });
          }
        } catch (e) { /* skip */ }
      }
    }
    return items;
  };

  const handleQuickOpenSelect = (item: any) => {
    if (item.entityType === 'chapter') openChapterTab(item.data);
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
      try {
        const { apiService } = await import('@/services/api.service');
        const { prepareEntityForSave, processForeignRelationships } = await import('@/services/relationship-save.service');
        const { entityApi } = await import('@/services/Entity/entity.api');
        const dataToSave = editor.data as any;
        await prepareEntityForSave(editor.entityType, dataToSave);
        const foreignUpdatesToProcess = (editor as any)._foreignUpdates;
        (editor as any)._foreignUpdates = null;
        delete dataToSave.__foreignUpdates;
        if (connectionsManager) {
          try {
            connectionsManager.setCurrentEntity(editor.entityType, editor.rawId);
            connectionsManager.setFormData(dataToSave);
            connectionsManager.setCurrentProject(projectName.value);
            const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
            if (configRes.ok) {
              const config = await configRes.json();
              connectionsManager.setConfig(config);
              await connectionsManager.saveConnections();
            }
          } catch (connError) {
            console.error(`[saveAll] Error saving connections:`, connError);
          }
        }
        const foreignUpdatesFinal = foreignUpdatesToProcess || {};
        try {
          const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
          if (configRes.ok) {
            const schemaConfig = await configRes.json();
            const oldStateReq = await apiService.getEntity(projectName.value, editor.entityType, editor.rawId);
            const oldState = (oldStateReq as any)?.data || oldStateReq;
            if (oldState) {
              for (const section of schemaConfig.sections || []) {
                for (const dc of section.dynamicContainers || []) {
                  const tpl = schemaConfig.templates?.[dc.template];
                  if (tpl && tpl.isBidirectional) {
                    const dataPath = dc.dataPath || dc.id;
                    const linkClass = tpl.bidirectionalLinkClass;
                    let targetType = '';
                    if (tpl.fields) {
                      const targetField = tpl.fields.find((f: any) => f.class === linkClass);
                      if (targetField && targetField.entityType) targetType = targetField.entityType;
                    }
                    if (linkClass && targetType) {
                      const oldArr = Array.isArray(oldState[dataPath]) ? oldState[dataPath] : (Array.isArray(oldState[dc.id]) ? oldState[dc.id] : []);
                      const newArr = Array.isArray(dataToSave[dataPath]) ? dataToSave[dataPath] : (Array.isArray(dataToSave[dc.id]) ? dataToSave[dc.id] : []);
                      for (const oldItem of oldArr) {
                        const oldTarget = String(oldItem[linkClass] || '');
                        if (!oldTarget) continue;
                        const stillExists = newArr.some((newItem: any) => String(newItem[linkClass]) === oldTarget);
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
        const modifiedForeignEntities = foreignUpdatesFinal && Object.keys(foreignUpdatesFinal).length > 0 
          ? await processForeignRelationships(projectName.value, editor.rawId, foreignUpdatesFinal)
          : [];

        const mainPayload = entityApi.formatEntityPayload(projectName.value, editor.entityType, dataToSave, editor.rawId, editor.title);
        
        const savedEntity = await apiService.saveEntityWithRelations(projectName.value, mainPayload, modifiedForeignEntities);
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
    if (!silent && !confirm(`Удалить эту запись безвозвратно?`)) return;
    const colonIdx = tabId.indexOf(':');
    const rawId = colonIdx > -1 ? tabId.slice(colonIdx + 1) : tabId;
    try {
      await apiService.deleteEntity(projectName.value, entityType, rawId);
      closeEditor(tabId, true);
      if (activeTreeNode.value && activeTreeNode.value.type === entityType && activeTreeNode.value.node.id === rawId) {
        activeTreeNode.value = null;
      }
      if (currentSidebarTab.value) await loadEntityList(currentSidebarTab.value);
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
      addToast(`Запись удалена`, 'warn');
    } catch (e) {
      addLog(`Entity -> Delete error: ${e}`, 'error');
    }
  };

  const renameEntity = async (entityType: string, idToUpdate: string, newName: string) => {
    console.log('[renameEntity] called with:', { entityType, idToUpdate, newName });
    try {
      const detail = await apiService.getEntity(projectName.value, entityType, idToUpdate);
      console.log('[renameEntity] detail from server:', detail);
      
      // Use schema's titleField if available, fallback to detection
      const sch = await schema.loadSchema(entityType);
      const schemaTitleField = sch?.titleField || sch?.sections?.[0]?.fields?.find((f: any) => f.isTitle)?.path;
      const titleField = schemaTitleField || Object.keys(detail).find(k => k.toLowerCase() === 'name') || Object.keys(detail)[0];
      console.log('[renameEntity] titleField:', titleField, 'from schema:', schemaTitleField);
      
      if (titleField) {
        detail[titleField] = newName;
        await apiService.saveEntity(projectName.value, entityType, detail, idToUpdate);
        
        // The rawId in the tab may include a prefix like "entities:" — try both formats
        const rawId = String(detail.id || idToUpdate);
        const tabId = `entity:${entityType}:${rawId}`;
        const tabIdShort = `entity:${entityType}:${idToUpdate}`;
        console.log('[renameEntity] tabId:', tabId, 'tabIdShort:', tabIdShort);
        console.log('[renameEntity] allTabs before update:', openEditors.value.map((t: any) => ({ id: t.id, title: t.title, rawId: t.rawId, data: t.data })));
        
        // Try both tab ID formats
        const actualTabId = eg.findTabGlobal(tabId) ? tabId : (eg.findTabGlobal(tabIdShort) ? tabIdShort : null);
        console.log('[renameEntity] actualTabId found:', actualTabId);
        
        if (actualTabId) {
          eg.updateTabData(actualTabId, { title: newName });
          // Use handleUpdateData to properly update tab.data and trigger reactivity
          handleUpdateData(actualTabId, { [titleField]: newName });
        } else {
          console.warn('[renameEntity] Could not find tab for either format:', { tabId, tabIdShort });
          // Still dispatch event even if tab not found
        }
        
        console.log('[renameEntity] allTabs after update:', openEditors.value.map((t: any) => ({ id: t.id, title: t.title, data: t.data })));
        
        // Refresh tree and entity list
        if (chapterTreeRef.value) chapterTreeRef.value.load();
        if (currentSidebarTab.value === entityType) await loadEntityList(entityType);
        
        // Dispatch with the full rawId (with prefix) so EntityEditor can match by props.entityId
        document.dispatchEvent(new CustomEvent('ww:entity-renamed', { 
          detail: { id: rawId, type: entityType, name: newName } 
        }));
        console.log('[renameEntity] dispatched ww:entity-renamed with id:', rawId);
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
        const newChapter: any = {
          id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: newChapterTitle || 'Новая глава', content: '# Начните писать\n\n',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          wordCount: 0, footnotes: {}, timelineEvents: [], participants: [],
        };
        await apiService.saveChapter(projectName.value, newChapter);
        addLog(`Chapter -> Created [${newChapter.title}]`, 'success');
        addToast(`Глава "${newChapter.title}" создана`, 'success');
        chapters.value.push(newChapter);
        triggerRef(chapters);
        if (chapterTreeRef.value) chapterTreeRef.value.load();
        openChapterTab(newChapter);
        return;
      }

      const sch = await schema.loadSchema(entityType);
      const titleFieldPath: string = sch?.titleField || sch?.sections?.[0]?.fields?.[0]?.path || 'name';
      const initialData: any = {};
      const nameToSet = preDefinedName || prompt(`Введите название для нового элемента:`, 'Без названия');
      if (nameToSet === null) return;
      if (nameToSet) {
        const parts = titleFieldPath.split('.');
        let current = initialData;
        for (let i = 0; i < parts.length - 1; i++) { current[parts[i]] = {}; current = current[parts[i]]; }
        current[parts[parts.length - 1]] = nameToSet;
      }

      const saveResult = await apiService.saveEntity(projectName.value, entityType, initialData, undefined, nameToSet || undefined);
      const newEntityId = saveResult?.id;
      if (!newEntityId || newEntityId === 'undefined') {
        addLog(`Entity -> Error: сервер не вернул валидный ID для ${entityType}`, 'error');
        addToast(`Ошибка: не удалось создать ${entityType}`, 'error');
        return;
      }

      const newEntity = await apiService.getEntity(projectName.value, entityType, newEntityId);
      if (!newEntity) { addLog(`Entity -> Error: не удалось загрузить только что созданную сущность`, 'error'); return; }

      if (preDefinedName) {
        (newEntity as any).Name = preDefinedName;
        setValueByPath(newEntity, titleFieldPath, preDefinedName);
        await apiService.saveEntity(projectName.value, entityType, newEntity as any, newEntityId);
      }

      addLog(`Entity -> Created ${entityType} "${preDefinedName || newEntityId}"`, 'success');
      addToast(`Сущность "${preDefinedName || 'Создана'}" добавлена`, 'success');
      await loadEntityList(entityType);
      if (chapterTreeRef.value) chapterTreeRef.value.load();

      const entityToOpen: any = { ...newEntity, entityType };
      if (preDefinedName) entityToOpen.Name = preDefinedName;
      if (entityToOpen.id && entityToOpen.id !== 'undefined') await openEntity(entityToOpen);
      else addLog(`Entity -> Error: попытка открыть сущность с невалидным ID`, 'error');
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
      const hierarchy = await apiService.getHierarchy('');
      const allChapters = hierarchy.chapters || [];
      let maxNum = 0;
      let relevantCount = 0;
      if (Array.isArray(allChapters)) {
        const relevantChapters = allChapters.filter((c: any) => {
          const cArcId = c.arcId ? String(c.arcId) : null;
          const cVolId = c.volumeId ? String(c.volumeId) : null;
          const targetArcId = arcId ? String(arcId) : null;
          const targetVolId = volumeId ? String(volumeId) : null;
          if (targetArcId) return cArcId === targetArcId;
          if (targetVolId) return cVolId === targetVolId && !cArcId;
          return !cArcId && !cVolId;
        });
        relevantCount = relevantChapters.length;
        relevantChapters.forEach((c: any) => {
          const m = (c.title || '').match(/Глава\s*(\d+)/i);
          if (m) {
            const n = parseInt(m[1]);
            if (n > maxNum) maxNum = n;
          }
        });
      }
      const num = maxNum + 1;
      addLog(`Manuscript -> Next chapter number: ${num} (found ${relevantCount} in this section)`, 'info');
      const newCh: any = {
        id: `chapters:chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: `Глава ${num}`,
        content: '# Новая глава\n\n',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordCount: 0,
        footnotes: {},
        timelineEvents: [],
        participants: [],
        arcId,
        volumeId,
      };
      const saveRes = await apiService.saveChapter(projectName.value, newCh);
      if (saveRes && (saveRes as any).id) newCh.id = (saveRes as any).id;
      if (arcId || volumeId) await apiService.assignChapter(projectName.value, newCh.id, arcId, volumeId);
      addLog('Manuscript -> Created new chapter', 'success');
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load(newCh.id);
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

  const deleteChapter = async (chapter: any, silent = false) => {
    try {
      await apiService.deleteChapter(projectName.value, chapter.id);
      addLog(`Manuscript -> Deleted chapter ${chapter.title}`, 'success');
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      closeEditor(chapter.id);
    } catch (e) {
      addLog(`Manuscript -> Error deleting chapter: ${e}`, 'error');
    }
  };

  const renameChapter = async (chapter: any, newTitle: string) => {
    try {
      chapters.value = chapters.value.map((c: any) => c.id === chapter.id ? { ...c, title: newTitle } : c);
      const fullData = await apiService.getChapter(projectName.value, chapter.id);
      fullData.title = newTitle;
      await apiService.saveChapter(projectName.value, fullData);
      addLog(`Chapter renamed: ${newTitle}`, 'success');
      if (chapterTreeRef.value?.load) chapterTreeRef.value.load();
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    } catch (e) {
      console.error('Failed to rename chapter:', e);
      addLog(`Error renaming chapter: ${e}`, 'error');
    }
  };

  const compareIds = (id1: any, id2: any) => {
    if (!id1 && !id2) return true;
    if (!id1 || !id2) return false;
    return String(id1.id || id1).split(':').pop() === String(id2.id || id2).split(':').pop();
  };

  const closeEditorsFor = (predicate: (e: any) => boolean) => {
    for (const ed of openEditors.value.filter(predicate)) {
      closeEditor(ed.id, true);
      if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ed.id) {
        activeTreeNode.value = null;
      }
    }
  };

  const deleteVolume = async (volume: any, chaptersInVol: any[] = [], arcsInVol: any[] = [], silent: boolean = false) => {
    if (!silent && !confirm(`Удалить том "${volume.title}" и все его содержимое?`)) return;
    try {
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.volumeId, volume.id) ||
          arcsInVol.some(arcId => compareIds(e.data.arcId, arcId)) ||
          chaptersInVol.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInVol) {
        try { await apiService.deleteChapter(projectName.value, ch.id); } catch (err) { console.error('Ошибка удаления главы (vol):', err); }
        closeEditor(String(ch.id), true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
          activeTreeNode.value = null;
        }
      }
      for (const arcId of arcsInVol) {
        await apiService.deleteArc(projectName.value, arcId);
        if (activeTreeNode.value && activeTreeNode.value.type === 'arc' && activeTreeNode.value.node.id === arcId) {
          activeTreeNode.value = null;
        }
      }
      await apiService.deleteVolume(projectName.value, volume.id);
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

  const deleteArc = async (arc: any, chaptersInArc: any[] = [], silent: boolean = false) => {
    if (!silent && !confirm(`Удалить арку "${arc.title}" и все ее главы?`)) return;
    try {
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.arcId, arc.id) ||
          chaptersInArc.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInArc) {
        try { await apiService.deleteChapter(projectName.value, ch.id); } catch (err) { console.error('Ошибка удаления главы (arc):', err); }
        closeEditor(String(ch.id), true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
          activeTreeNode.value = null;
        }
      }
      await apiService.deleteArc(projectName.value, arc.id);
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
    selectTreeNode: (node: any) => { activeTreeNode.value = node; },
    handleScrollChange: (groupId: string, tabId: string, scroll: number) => {
      const group = eg.groups.value.find((g: any) => g.id === groupId);
      const tab = group?.tabs.find((t: any) => t.id === tabId);
      if (tab) { tab.scrollPos = scroll; saveState(); }
    },
    handleSectionChange: (groupId: string, tabId: string, sectionId: string) => {
      const group = eg.groups.value.find((g: any) => g.id === groupId);
      const tab = group?.tabs.find((t: any) => t.id === tabId);
      if (tab) {
        tab.activeSection = sectionId;
        saveState();
      }
    },
    openQuickOpen,
    openTagsManager,
    openFloatingEditor: (project: string, entityType: string, entityId: string) => floating.openFloatingEditor(project, entityType, entityId),
    openSandbox: () => { openSchemaEditor('universal'); },
    splitRight: () => eg.splitRight(),
    closeGroup: (gid: string) => eg.removeGroup(gid),
    moveTab: (p: any) => eg.moveTab(p.tabId, p.toGroupId, p.toIndex),
    reorderTab: (p: any) => eg.reorderTab(p.groupId, p.fromIdx, p.toIdx),
    activateTabInGroup: (gid: string, tid: string) => {
      const g = eg.groups.value.find((gr: any) => gr.id === gid);
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
  };
});
