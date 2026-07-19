/**
 * @file useAppShell.ts
 * @description Composition root — весь setup() главного окна. app.ts только монтирует.
 */
import { ref, computed, watch, onMounted, nextTick, shallowRef, triggerRef } from 'vue';
import { useEditorGroups, settingsService, setLocale, i18n } from '@worldwiki/components';
import { apiService } from '../services/api.service';
import { connectionsManager } from '../services/connections.service';
import { useFloatingEditors } from './useFloatingEditors';
import { getValueByPath, setValueByPath } from '@/utils/path';
import { useHotkeys } from '@/composables/useHotkeys';
import { useResizers } from '@/composables/useResizers';
import { useSchemaCache } from '@/composables/useSchemaCache';
import { useZoom } from '@/composables/useZoom';
import { useConsole } from '@/composables/useConsole';
import { useEntityLists } from '@/composables/useEntityLists';
import { useEditorTabs } from '@/composables/useEditorTabs';
import { useChapterOps } from '@/composables/useChapterOps';
import { useEntityOps } from '@/composables/useEntityOps';
import { useQuickOpen } from '@/composables/useQuickOpen';
import { usePersistence } from '@/composables/usePersistence';
import { useSaveManager } from '@/composables/useSaveManager';
import { useFloatingWindows } from '@/composables/useFloatingWindows';

interface SidebarItem {
  type: 'static' | 'entity' | 'chapters';
  url?: string;
  entityType?: string;
  icon: string;
  emoji: string;
  title: string;
}

interface ConsoleLog {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

export function useAppShell(ctx: {
  projectName: string;
  sidebarItems: SidebarItem[];
}) {
  const { projectName, sidebarItems } = ctx;

  // ─── Editor Groups ─────────────────────────
  const eg = useEditorGroups() as any;

  // Compat aliases
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

  // ─── Log ─────────────────────────
  let logCounter = 0;
  const addLog = (text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const logs = consoleLogs.value;
    logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
    if (logs.length > 100) logs.splice(100);
    triggerRef(consoleLogs);
  };

  // ─── Infrastructure composables ─────
  const zoom = useZoom();
  const consoleModule = useConsole({ settings });
  const toasts = consoleModule.toasts;
  const addToast = consoleModule.addToast;
  const getToastIcon = consoleModule.getToastIcon;
  const zoomLevel = zoom.zoomLevel;
  const applyZoom = zoom.applyZoom;

  const schema = useSchemaCache();
  const loadSchema = schema.loadSchema;
  const getEntityDisplayName = schema.getEntityDisplayName;

  const chapterTreeRef = ref<any>(null);

  const lists = useEntityLists({
    schema,
    projectName,
    addLog,
    chapterTreeRef,
  });
  const entityLists = lists.entityLists;
  const chapters = lists.chapters;

  const tabs = useEditorTabs({
    eg,
    schema,
    lists: { currentSidebarTab: lists.currentSidebarTab, loadChapters: lists.loadChapters },
    projectName,
    addLog,
    getToastIcon,
  });

  const chaptersOps = useChapterOps({
    projectName,
    addLog,
    addToast,
    closeEditor: tabs.closeEditor,
    openChapterTab: tabs.openChapterTab,
    chapterTreeRef,
    openEditors,
    lists,
    tabs: { activeTreeNode },
  });

  const entitiesOps = useEntityOps({
    projectName,
    addLog,
    addToast,
    schema,
    lists,
    tabs,
    chapterTreeRef,
    activeTreeNode,
  });

  const quickOpen = useQuickOpen({
    projectName,
    lists,
    tabs,
    schema,
    addLog,
  });

  const persistence = usePersistence({
    projectName,
    activeView,
    currentSidebarTab: lists.currentSidebarTab,
    activePanelTab,
    activeTreeNode,
  });

  const saveManager = useSaveManager({
    projectName,
    tabs,
    lists,
    schema,
    addLog,
    addToast,
    chapterTreeRef,
    connectionsManager,
  });

  const floatingWindows = useFloatingWindows({ projectName });

  // ─── Persistence ─────────────────────────
  const STATE_KEY = `worldwiki-state-${projectName}`;
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
            await loadSchema(tab.entityType);
            const detail = await apiService.getEntity(projectName, tab.entityType, tab.rawId);
            loadedTabs.set(tab.id, { ...tab, data: detail, unsaved: false });
          } else if (tab.tabType === 'chapter') {
            const chapter = await apiService.getChapter(projectName, tab.rawId);
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

  // ─── Computed ─────────────────────────
  const activeEntityRawId = computed(() => activeEditor.value?.rawId || '');
  const activeSidebarItem = computed(() =>
    sidebarItems.find(i =>
      i.entityType === currentSidebarTab.value ||
      i.url === currentSidebarTab.value ||
      (i.type === 'chapters' && currentSidebarTab.value === 'chapters')
    ) || null
  );
  const filteredEntityList = computed(() => {
    const q = sidebarSearch.value.toLowerCase();
    if (currentSidebarTab.value === 'chapters') {
      const list = chapters.value || [];
      return q ? list.filter((c: any) => String(c.title || '').toLowerCase().includes(q)) : list;
    }
    const list = entityLists.value[currentSidebarTab.value || ''] || [];
    return q ? list.filter((e: any) => getEntityDisplayName(e, currentSidebarTab.value || undefined).toLowerCase().includes(q)) : list;
  });
  const unsavedCount = computed(() => openEditors.value.filter((e: any) => e.unsaved).length);

  // ─── Methods ─────────────────────────
  const selectSidebarTab = (item: SidebarItem) => {
    if (item.type === 'static' && item.url) {
      window.location.href = item.url + (item.url.includes('?') ? '&' : '?') + `project=${encodeURIComponent(projectName)}`;
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
    if (item.entityType) lists.loadEntityList(item.entityType);
  };

  const loadEntityList = async (entityType: string) => {
    try {
      await loadSchema(entityType);
      const list = await apiService.getEntityList(projectName, entityType);
      entityLists.value[entityType] = list as Array<Record<string, unknown>>;
      addLog(`Data -> Loaded ${list.length} ${entityType}(s)`, 'info');
    } catch (e) {
      addLog(`Data -> Error loading ${entityType}: ${e}`, 'error');
      entityLists.value[entityType] = [];
    }
  };

  const loadChapters = async () => {
    try {
      const list = await apiService.getChaptersList(projectName);
      chapters.value = list as Array<any>;
      addLog(`Data -> Loaded ${chapters.value.length} chapter(s)`, 'info');
    } catch (e) {
      addLog(`Data -> Error loading chapters: ${e}`, 'error');
      chapters.value = [];
    }
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
        await loadSchema(entityType);
        const detail = await apiService.getEntity(projectName, entityType, rawId);
        const tabTitle = (entity as any).Name || (entity as any).name || (entity as any).title || getEntityDisplayName(detail as Record<string, unknown>, entityType);
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

  const closeEditor = (id: string, force = false) => {
    eg.closeTab(id, force);
    addLog(`Editor -> Closed [${id}]`, 'warn');
  };

  const deleteEntity = async (tabId: string, entityType: string, silent = false) => {
    try {
      const parts = tabId.split(':');
      // Tab ID is usually "entity:type:actualId"
      // actualId might contain colons (e.g. "entities:person_123")
      const rawId = parts.length > 2 ? parts.slice(2).join(':') : tabId;

      await apiService.deleteEntity(projectName, entityType, rawId);
      closeEditor(tabId, true);

      if (activeTreeNode.value && activeTreeNode.value.type === entityType && activeTreeNode.value.node.id === rawId) {
        activeTreeNode.value = null;
      }
      if (currentSidebarTab.value) await loadEntityList(currentSidebarTab.value);
      if (chapterTreeRef.value) chapterTreeRef.value.load();
      addToast(`Запись удалена`, 'warn');
    } catch (e) {
      addLog(`Entity -> Delete error: ${e}`, 'error');
    }
  };

  const markUnsaved = (tabId?: string) => {
    const id = tabId ?? activeEditor.value?.id;
    if (id) eg.markTabUnsaved(id);
  };

  const markSaved = (tabId?: string) => {
    const id = tabId ?? activeEditor.value?.id;
    if (id) { eg.markTabSaved(id); addToast('Глава сохранена', 'success'); }
  };

  const mountEntityEditor = (_id: string) => { /* stub */ };

  const renameChapter = chaptersOps.renameChapter;
  const createChapterIn = chaptersOps.createChapterIn;
  const deleteChapter = chaptersOps.deleteChapter;

  const closeAllTabs = () => eg.closeAll();

  const toggleSettings = () => { showSettings.value = !showSettings.value; };
  const resetSettings = () => { settingsService.resetSettings(); addLog('Settings -> Reset', 'warn'); };

  const openTagsManager = () => tagsManagerRef.value?.open();

  const toggleEntityHistory = (rawId: string) => {
    document.dispatchEvent(new CustomEvent('ww:toggle-entity-history', { detail: { id: rawId } }));
  };

  const onChapterRenamed = ({ id, title }: { id: string; title: string }) => {
    eg.updateTabData(id, { title });
  };

  // 🔴 handleUpdateData
  const handleUpdateData = (tabId: string, newData: any) => {
    console.log('[handleUpdateData] called with:', { tabId, newData });
    const tabsToUpdate = eg.allTabs.value.filter((t: any) => t.id === tabId);
    console.log('[handleUpdateData] tabsToUpdate:', tabsToUpdate.length, tabsToUpdate.map((t: any) => ({ id: t.id, title: t.title, data: t.data })));
    if (tabsToUpdate.length === 0) {
      console.warn('[handleUpdateData] No tabs found for tabId:', tabId);
      return;
    }
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
      
      const newTitle = getEntityDisplayName(tab.data as Record<string, unknown>, tab.entityType);
      if (newTitle && newTitle !== oldTitle) {
        tab.title = newTitle;
      }
    }
  };

  const renameEntity = async (entityType: string, idToUpdate: string, newName: string) => {
    console.log('[renameEntity] called with:', { entityType, idToUpdate, newName });
    try {
      const detail = await apiService.getEntity(projectName, entityType, idToUpdate);
      console.log('[renameEntity] detail from server:', detail);
      
      // Use schema's titleField if available, fallback to detection
      const sch = await loadSchema(entityType);
      const schemaTitleField = sch?.titleField || sch?.sections?.[0]?.fields?.find((f: any) => f.isTitle)?.path;
      const titleField = schemaTitleField || Object.keys(detail).find(k => k.toLowerCase() === 'name') || Object.keys(detail)[0];
      console.log('[renameEntity] titleField:', titleField, 'from schema:', schemaTitleField);
      
      if (titleField) {
        detail[titleField] = newName;
        await apiService.saveEntity(projectName, entityType, detail, idToUpdate);
        
        // The rawId in the tab may include a prefix like "entities:" — try both formats
        const rawId = String(detail.id || idToUpdate);
        const tabId = `entity:${entityType}:${rawId}`;
        const tabIdShort = `entity:${entityType}:${idToUpdate}`;
        console.log('[renameEntity] tabId:', tabId, 'tabIdShort:', tabIdShort);
        console.log('[renameEntity] allTabs before update:', eg.allTabs.value.map((t: any) => ({ id: t.id, title: t.title, rawId: t.rawId, data: t.data })));
        
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
        
        console.log('[renameEntity] allTabs after update:', eg.allTabs.value.map((t: any) => ({ id: t.id, title: t.title, data: t.data })));
        
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

  // ─── Resource creation ─────────────────────────
  const isCreatingEntity = ref(false);
  const resizers = useResizers({ settings, saveState, splitLeftWidth });

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
        await apiService.saveChapter(projectName, newChapter);
        addLog(`Chapter -> Created [${newChapter.title}]`, 'success');
        addToast(`Глава "${newChapter.title}" создана`, 'success');
        chapters.value.push(newChapter);
        triggerRef(chapters);
        if (chapterTreeRef.value) chapterTreeRef.value.load();
        openChapterTab(newChapter);
        return;
      }

      const sch = await loadSchema(entityType);
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

      const saveResult = await apiService.saveEntity(projectName, entityType, initialData, undefined, nameToSet || undefined);
      const newEntityId = saveResult?.id;
      if (!newEntityId || newEntityId === 'undefined') {
        addLog(`Entity -> Error: сервер не вернул валидный ID для ${entityType}`, 'error');
        addToast(`Ошибка: не удалось создать ${entityType}`, 'error');
        return;
      }

      const newEntity = await apiService.getEntity(projectName, entityType, newEntityId);
      if (!newEntity) { addLog(`Entity -> Error: не удалось загрузить только что созданную сущность`, 'error'); return; }

      if (preDefinedName) {
        (newEntity as any).Name = preDefinedName;
        setValueByPath(newEntity, titleFieldPath, preDefinedName);
        await apiService.saveEntity(projectName, entityType, newEntity as any, newEntityId);
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

  // ─── QuickOpen ─────────────────────────
  const quickOpenDataSource = async (): Promise<any[]> => {
    const items: any[] = [];
    try {
      const list = await apiService.getChaptersList(projectName);
      for (const c of list as Array<any>) {
        items.push({ id: `chapter_${c.id}`, rawId: String(c.id), title: c.title || `Глава ${c.id}`, typeLabel: 'Глава', entityType: 'chapter', emoji: '📝', data: c });
      }
    } catch (e) { /* skip */ }
    for (const tab of sidebarItems) {
      if (tab.type === 'entity' && tab.entityType) {
        try {
          const list = await apiService.getEntityList(projectName, tab.entityType);
          for (const e of list as Array<any>) {
            items.push({ id: `entity_${tab.entityType}_${e.id}`, rawId: String(e.id), title: getEntityDisplayName(e, tab.entityType), typeLabel: tab.title, entityType: tab.entityType, emoji: tab.icon || '📄', data: { ...e, entityType: tab.entityType } });
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

  // ─── Watches ─────────────────────────
  watch(activePanelTab, () => { if (!isRestoring) saveState(); });
  watch([activeView, currentSidebarTab, activePanelTab, activeTreeNode], saveState);
  watch(eg.groups, saveState, { deep: true });
  watch(() => settingsService.getSettings(), (n) => { settingsService.saveSettings(n); }, { deep: true });

  // ─── Lifecycle ─────────────────────────
  onMounted(() => {
    applyZoom(zoomLevel.value);
    settingsService.onChange((newSettings) => { settings.value = newSettings; });

    useHotkeys({
      projectName, saveAll: saveManager.saveAll, toggleSettings, quickOpenRef, commandPaletteRef,
      tagsManagerRef, applyZoom, sidebarVisible, activePanelTab, activeEditorId, closeEditor,
      addNewEntity, createChapterIn, splitRight: () => eg.splitRight(), currentSidebarTab, zoomLevel, showSettings,
    }).register();

    addLog('System -> Glass Engine v3 initialized', 'success');
    addLog(`System -> Project: ${projectName}`, 'info');

    try {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen('ww-entity-saved', (event: any) => {
          const { type, id } = event.payload || {};
          if (type && id) {
            addLog(`Внешнее окно: сохранен ${type} [${id}]`, 'success');
            if (currentSidebarTab.value === type) loadEntityList(type);
          }
        });
      }).catch(() => {});
    } catch (e) { /* skip */ }

    restoreState().then(restored => {
      if (!restored) {
        const firstEntity = sidebarItems.find(i => i.type === 'entity');
        if (firstEntity) { currentSidebarTab.value = firstEntity.entityType!; loadEntityList(firstEntity.entityType!); }
      } else {
        if (currentSidebarTab.value && currentSidebarTab.value !== 'chapters') loadEntityList(currentSidebarTab.value);
        else if (currentSidebarTab.value === 'chapters') loadChapters();
      }
    });
  });

  // ─── Return (Template API) ─────────────────────────
  return {
    // State
    projectName, activeView, currentSidebarTab, showSettings, sidebarSearch, activePanelTab,
    openEditors, activeEditorId, activeEditor, activeEntityRawId, consoleLogs, activeField,
    panelHeight, sidebarWidth, sidebarItems, activeSidebarItem, filteredEntityList, chapters,
    chapterTreeRef, sidebarVisible, zoomLevel, quickOpenRef, commandPaletteRef, tagsManagerRef,
    settings, toasts, addToast, getToastIcon,
    unsavedCount,
    // Methods
    selectSidebarTab, openEntity, openSchemaEditor, openChapterTab, closeEditor, markUnsaved, markSaved,
    saveAll: saveManager.saveAll, closeAllTabs, addNewEntity,
    startResize: resizers.startResize, startSidebarResize: resizers.startSidebarResize,
    startSplitResize: resizers.startSplitResize, startGroupResize: resizers.startGroupResize,
    toggleSettings, resetSettings, addLog, handleUpdateData, getEntityDisplayName,
    deleteEntity, deleteVolume: chaptersOps.deleteVolume, deleteArc: chaptersOps.deleteArc,
    createChapterIn, deleteChapter, renameChapter, renameEntity, activeTreeNode, applyZoom,
    quickOpenDataSource, handleQuickOpenSelect,
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
        const newTitle = getEntityDisplayName(tab.data as Record<string, unknown>, tab.entityType);
        if (newTitle && newTitle !== tab.title) {
          tab.title = newTitle;
          if (chapterTreeRef.value) chapterTreeRef.value.load();
          if (currentSidebarTab.value === tab.entityType) loadEntityList(currentSidebarTab.value as string);
        }
        saveState();
      }
    },
    openQuickOpen: () => quickOpenRef.value?.open(),
    openTagsManager: () => tagsManagerRef.value?.open(),
    openFloatingEditor: (window as any).openFloatingEditor,
    onChapterRenamed, toggleEntityHistory,
    openSandbox: () => { openSchemaEditor('universal'); },
    // Editor Groups API
    editorGroups: eg.groups, activeGroupId: eg.activeGroupId,
    splitRight: () => eg.splitRight(), closeGroup: (gid: string) => eg.removeGroup(gid),
    moveTab: (p: any) => eg.moveTab(p.tabId, p.toGroupId, p.toIndex),
    reorderTab: (p: any) => eg.reorderTab(p.groupId, p.fromIdx, p.toIdx),
    activateTabInGroup: (gid: string, tid: string) => {
      const g = eg.groups.value.find((gr: any) => gr.id === gid);
      if (g) { g.activeTabId = tid; eg.activeGroupId.value = gid; }
    },
    focusGroup: (gid: string) => { eg.activeGroupId.value = gid; },
  };
}