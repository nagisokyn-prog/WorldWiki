/**
 * @file app.ts
 * @description Единая точка входа — VS Code-подобный интерфейс
 * ОПТИМИЗИРОВАН: shallowRef для больших данных, defineAsyncComponent для компонентов
 */

import { createApp, ref, computed, watch, onMounted, nextTick, shallowRef, triggerRef, defineAsyncComponent, type Plugin } from 'vue';
import { i18n, setLocale } from '../../../tauri-surreal-kit/frontend/src/js/i18n';
import { settingsService } from '../../../tauri-surreal-kit/frontend/src/js/services/settings.service';
import { apiService } from '../services/api.service';
import { connectionsManager } from '../services/connections.service';
import { useEditorGroups } from '../../../tauri-surreal-kit/frontend/src/js/composables/useEditorGroups';
import { prepareEntityForSave, saveForeignRelationships } from '../services/relationship-save.service';
import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { MotionPlugin } from '@vueuse/motion';

// ✅ ОПТИМИЗАЦИЯ: Критические компоненты загружаются сразу (видны при старте)
import QuickOpenVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/QuickOpen.vue';
import CommandPaletteVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/CommandPalette.vue';
import ChapterTreeVue from '../components/Vue/Chapters/ChapterTree.vue';
import ChaptersMainVue from '../components/Vue/Chapters/ChaptersMain.vue';
import EditorTabBarVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/EditorTabBar.vue';
import EditorGroupPaneVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/EditorGroupPane.vue';

// ✅ ОПТИМИЗАЦИЯ: Тяжелые компоненты — динамический импорт (lazy loading)
const EntityEditorVue = defineAsyncComponent(() => import('../components/Vue/EntityEditor.vue'));
const ChaptersViewVue = defineAsyncComponent(() => import('../components/Vue/ChaptersView.vue'));
const EditorCoreVue = defineAsyncComponent(() => import('../components/Vue/Chapters/EditorCoreTiptap.vue'));
const TimelinePanelVue = defineAsyncComponent(() => import('../components/Vue/Calendars/TimelinePanel.vue'));
const ParticipantsPanelVue = defineAsyncComponent(() => import('../components/Vue/Chapters/ParticipantsPanel.vue'));
const PlanningPanelVue = defineAsyncComponent(() => import('../components/Vue/Chapters/PlanningPanel.vue'));
const ExportModalVue = defineAsyncComponent(() => import('../components/Vue/Chapters/ExportModal.vue'));
const WowilonDrawerVue = defineAsyncComponent(() => import('../components/Vue/Chapters/WowilonDrawer.vue'));
const TagsManagerModalVue = defineAsyncComponent(() => import('../components/Vue/TagsManagerModal.vue'));
const TagsField = defineAsyncComponent(() => import('../../../tauri-surreal-kit/frontend/src/components/Vue/TagsField.vue'));
const FloatingEntityEditorVue = defineAsyncComponent(() => import('../components/Vue/FloatingEntityEditor.vue'));
const RedactSandboxVue = defineAsyncComponent(() => import('../components/Vue/RedactSandbox.vue'));
const SchemaEditorMainVue = defineAsyncComponent(() => import('../components/Vue/SchemaEditor/SchemaEditorMain.vue'));
const CloudSyncModalVue = defineAsyncComponent(() => import('../components/Vue/CloudSyncModal.vue'));

// Типы
interface SidebarItem {
  type: 'static' | 'entity' | 'chapters';
  url?: string;
  entityType?: string;
  icon: string;
  emoji: string;
  title: string;
}

interface EditorTab {
  id: string;       // Составной ключ entityType:rawId (для уникальности вкладок)
  rawId: string;    // Чистый ID из БД (для API-запросов)
  title: string;
  entityType: string;
  tabType: 'entity' | 'chapter';
  data: Record<string, unknown>;
  unsaved: boolean;
  scrollPos?: number;
  activeSection?: string;
}

interface ConsoleLog {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

interface FloatingEditor {
  id: string; // entityType:entityId
  entityType: string;
  entityId: string;
  zIndex: number;
}

// Глобальный доступ к Vue
if (typeof window !== 'undefined') {
  (window as any).Vue = (window as any).Vue || {};
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project') || 'default';

  // Загружаем sidebar.json
  let sidebarItems: SidebarItem[] = [];
  try {
    const res = await fetch('./struct/sidebar.json');
    sidebarItems = await res.json();
  } catch (e) {
    console.warn('Failed to load sidebar.json:', e);
  }

  // Загружаем схемы сущностей
  let entitySchemas: Record<string, any> = {};
  try {
    entitySchemas = await apiService.getSchemas(projectName);
    
    // Подмешиваем динамические схемы из БД в сайдбар, если их там ещё нет
    for (const [typeKey, schema] of Object.entries(entitySchemas)) {
      if (!sidebarItems.find(item => item.entityType === typeKey)) {
        sidebarItems.push({
          type: 'entity',
          entityType: typeKey,
          icon: 'fas fa-cube',
          emoji: schema.icon || '🧩',
          title: schema.name || typeKey
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load schemas:', e);
  }

  // Применяем настройки
  settingsService.applySettings();
  await settingsService.loadSettings().catch(e => console.warn('Failed to load settings:', e));
  setLocale(settingsService.getSettings().locale || 'ru');

    const app = createApp({
    setup() {
      // ─── Editor Groups (VS Code-style split panels) ─────────────────────────
      const eg = useEditorGroups();

      // Compat aliases для всего старого кода
      const openEditors = computed(() => eg.allTabs.value);
      const activeEditorId = computed({
        get: () => eg.activeGroup.value?.activeTabId ?? null,
        set: (id: string | null) => {
          if (id) {
            // Активируем вкладку в той группе где она есть
            const g = eg.findGroupByTab(id);
            if (g) {
              g.activeTabId = id;
              eg.activeGroupId.value = g.id;
            }
          }
        }
      });
      const activeEditor = computed(() => eg.activeTab.value);

      // State
      const activeView = ref<'entity' | 'chapters' | 'static' | 'sandbox'>('entity');
      const currentSidebarTab = ref<string | null>(null);
      const showSettings = ref(false);
      const sidebarSearch = ref('');
      const activePanelTab = ref('');

      const consoleLogs = shallowRef<ConsoleLog[]>([]);
      const entityLists = shallowRef<Record<string, Array<Record<string, unknown>>>>({});
      const chapters = shallowRef<Array<any>>([]);

      const activeField = ref('name');
      const panelHeight = ref(parseInt(localStorage.getItem('app-panel-height') || '150'));
      const sidebarWidth = ref(parseInt(localStorage.getItem('app-sidebar-width') || '280'));
      const activeTreeNode = ref<{ type: string; node: any } | null>(null);
      const floatingEditors = ref<FloatingEditor[]>([]);
      const nextZIndex = ref(20000);
      const sidebarVisible = ref(true);
      const zoomLevel = ref(parseFloat(localStorage.getItem('app-zoom') || '1'));
      const quickOpenRef = ref<any>(null);
      const commandPaletteRef = ref<any>(null);
      const tagsManagerRef = ref<any>(null);
      const settings = ref(settingsService.getSettings());

      // Toasts state
      interface Toast {
        id: number;
        text: string;
        type: 'success' | 'warn' | 'error' | 'info';
      }
      const toasts = ref<Toast[]>([]);
      let toastIdCounter = 0;

      const addToast = (text: string, type: Toast['type'] = 'info') => {
        const id = ++toastIdCounter;
        toasts.value.push({ id, text, type });
        setTimeout(() => {
          toasts.value = toasts.value.filter(t => t.id !== id);
        }, settings.value.notifications.duration);
      };

      const getToastIcon = (type: Toast['type']) => {
        switch (type) {
          case 'success': return 'fas fa-check-circle';
          case 'warn': return 'fas fa-exclamation-triangle';
          case 'error': return 'fas fa-times-circle';
          default: return 'fas fa-info-circle';
        }
      };

      // Apply saved zoom on mount
      const applyZoom = (level: number) => {
        const clamped = Math.max(0.5, Math.min(2, level));
        zoomLevel.value = clamped;
        
        // Set CSS variable for global zoom
        document.documentElement.style.setProperty('--app-zoom', String(clamped));
        
        // Apply transform to the app container
        const appEl = document.getElementById('app');
        if (appEl) {
          appEl.style.transform = `scale(${clamped})`;
          appEl.style.transformOrigin = 'top left';
          appEl.style.width = `${100 / clamped}%`;
          appEl.style.height = `${100 / clamped}%`;
        }
        
        localStorage.setItem('app-zoom', String(clamped));
      };

      // --- Persistence Logic ---
      const STATE_KEY = `worldwiki-state-${projectName}`;
      let isRestoring = false;
      
      const saveState = () => {
        if (isRestoring) return;
        const state = {
          activeView: activeView.value,
          currentSidebarTab: currentSidebarTab.value,
          activePanelTab: activePanelTab.value,
          activeTreeNode: activeTreeNode.value,
          editorGroups: eg.serializeState(),
          activeGroupId: eg.activeGroupId.value,
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
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

          // Новый формат: editorGroups
          const rawGroups = state.editorGroups;
          const rawTabs = state.openTabs; // обратная совместимость

          const tabSources: Array<{id:string;rawId:string;title:string;entityType:string;tabType:string;scrollPos?:number;activeSection?:string}> =
            rawGroups ? rawGroups.flatMap((g: any) => g.tabs) : (rawTabs || []);

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
            // Обратная совместимость: старый формат openTabs -> одна группа
            const group = eg.groups.value[0];
            for (const [, tab] of loadedTabs) {
              group.tabs.push(tab as any);
            }
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

      watch(activePanelTab, () => {
        if (!isRestoring) saveState();
      });

      // Dynamic data - уже объявлены выше через shallowRef
      const chapterTreeRef = ref<any>(null);

      // Хелперы для работы с вложенными путями (типа "основное_ключ.полное_имя")
      const getValueByPath = (obj: any, path: string): any => {
        return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
      };
      const setValueByPath = (obj: any, path: string, value: any): void => {
        const parts = path.split('.');
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
      };

      // Кэш схем по типу сущности (чтобы не грузить каждый раз)
      const schemaCache: Record<string, any> = {};
      const loadSchema = async (entityType: string): Promise<any> => {
        if (schemaCache[entityType]) return schemaCache[entityType];
        try {
          const res = await fetch(`/struct/editor/${entityType}.json`);
          if (res.ok) { schemaCache[entityType] = await res.json(); }
        } catch {}
        return schemaCache[entityType] || null;
      };

      // Хелпер для отображения имени сущности (поле Name гарантировано в каждом JSON)
      const getEntityDisplayName = (entity: Record<string, unknown>, entityType?: string): string => {
        if (!entity) return 'Без названия';
        
        // 1. Проверка по titleField из схемы (ПРИОРИТЕТ)
        if (entityType && schemaCache[entityType]) {
          const path = schemaCache[entityType].titleField;
          if (path) {
            const val = getValueByPath(entity, path);
            if (val && String(val).trim().length > 0) {
              return String(val).trim();
            }
          }
        }

        // 2. Прямая гарантия пользователя: имя стоит на первом месте
        const keys = Object.keys(entity);
        if (keys.length > 0) {
          const firstVal = entity[keys[0]];
          if (typeof firstVal === 'string' && firstVal.trim().length > 0) {
            return firstVal.trim();
          }
        }

        return `[${String(entity.id || 'Unknown').substring(0, 8)}]`;
      };

      // Computed (activeEditor уже объявлен выше через eg)
      // Чистый ID сущности для передачи в EntityEditor + API (без префикса entityType:)
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
        // Если выбраны главы, показываем список глав
        if (currentSidebarTab.value === 'chapters') {
          const list = chapters.value || [];
          return q ? list.filter((c: any) => {
            const name = String(c.title || '').toLowerCase();
            return name.includes(q);
          }) : list;
        }
        // Иначе показываем список сущностей
        const list = entityLists.value[currentSidebarTab.value || ''] || [];
        return q ? list.filter((e: any) => {
          const name = getEntityDisplayName(e as Record<string, unknown>, currentSidebarTab.value || undefined).toLowerCase();
          return name.includes(q);
        }) : list;
      });
      const unsavedCount = computed(() => openEditors.value.filter(e => e.unsaved).length);

      // Methods
      let logCounter = 0;
      const addLog = (text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
        // ✅ ОПТИМИЗАЦИЯ: Ограничиваем размер логов до 100 вместо 200, и используем массив напрямую
        const logs = consoleLogs.value;
        logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
        if (logs.length > 100) {
          // Удаляем последние элементы вместо pop() для лучшей производительности
          logs.splice(100);
        }
        // Указываем Vue что массив изменился (важно для shallowRef)
        triggerRef(consoleLogs);
      };

      const selectSidebarTab = (item: SidebarItem) => {
        if (item.type === 'static' && item.url) {
          window.location.href = item.url + (item.url.includes('?') ? '&' : '?') + `project=${encodeURIComponent(projectName)}`;
          return;
        }
        if (item.type === 'chapters') {
          currentSidebarTab.value = 'chapters';
          activeView.value = 'entity';
          addLog(`Navigation -> Chapters`, 'info');
          return;
        }
        activeView.value = 'entity';
        currentSidebarTab.value = item.entityType || null;
        addLog(`Navigation -> ${item.title}`, 'info');
        
        if (item.entityType) {
          loadEntityList(item.entityType);
        }
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
          chapters.value = (list as Array<any>);
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
            tabType: 'schema-editor', data: {}, unsaved: false
          });
          addLog(`Editor -> Opened Schema Editor for ${entityType}`, 'info');
        } else {
          eg.openTab({ id: tabId } as any); // just switch focus
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
              tabType: 'entity', data: detail as Record<string, unknown>, unsaved: false
            });
            addLog(`Editor -> Opened ${entityType} [${tabTitle}]`, 'info');
          } catch (e) {
            addLog(`Editor -> Error opening: ${e}`, 'error');
            return;
          }
        } else {
          // Вкладка уже есть — просто активируем
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
            id, rawId: id,
            title: chapter.title || `Глава ${id}`,
            entityType: 'chapter', tabType: 'chapter',
            data: chapter, unsaved: false,
          });
        } else {
          const g = eg.findGroupByTab(id);
          if (g) { g.activeTabId = id; eg.activeGroupId.value = g.id; }
        }
        activeView.value = 'entity';
        addLog(`Editor -> Chapter [${chapter.title}]`, 'info');
      };

      let isCreatingChapter = false;
      const createChapterIn = async ({ arcId, volumeId }: { arcId?: string; volumeId?: string }) => {
        if (isCreatingChapter) return;
        isCreatingChapter = true;
        try {
          const hierarchy = await apiService.getHierarchy(projectName);
          const allChapters = hierarchy.chapters || [];
          
          let maxNum = 0;
          let relevantCount = 0;
          
          if (allChapters && Array.isArray(allChapters)) {
            // Фильтруем главы, чтобы найти максимум именно в этой арке/томе
            const relevantChapters = allChapters.filter(c => {
              const cArcId = c.arcId ? String(c.arcId) : null;
              const cVolId = c.volumeId ? String(c.volumeId) : null;
              const targetArcId = arcId ? String(arcId) : null;
              const targetVolId = volumeId ? String(volumeId) : null;

              if (targetArcId) return cArcId === targetArcId;
              if (targetVolId) return cVolId === targetVolId && !cArcId;
              return !cArcId && !cVolId;
            });

            relevantCount = relevantChapters.length;

            relevantChapters.forEach(c => {
              const m = (c.title || "").match(/Глава\s*(\d+)/i);
              if (m) {
                const n = parseInt(m[1]);
                if (n > maxNum) maxNum = n;
              }
            });
          }
          
          const num = maxNum + 1;
          addLog(`Manuscript -> Next chapter number: ${num} (found ${relevantCount} in this section)`, 'info');
          const newCh = {
            id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: `Глава ${num}`,
            content: '# Новая глава\n\n',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            wordCount: 0,
            footnotes: {},
            timelineEvents: [],
            participants: [],
            arcId,
            volumeId
          };

          // 1. Сохраняем саму главу
          const saveRes = await apiService.saveChapter(projectName, newCh);
          if (saveRes && saveRes.id) {
            newCh.id = saveRes.id;
          }
          
          // 2. Явно привязываем её к иерархии (на случай если saveChapter не учитывает arcId)
          if (arcId || volumeId) {
            await apiService.assignChapter(projectName, newCh.id, arcId, volumeId);
          }

          addLog(`Manuscript -> Created new chapter`, 'success');
          // Обновляем дерево глав (с авто-раскрытием)
          await chapterTreeRef.value?.load(newCh.id);
          document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
          
          // Обновляем локальный список глав если он загружен
          if (chapters.value) {
            chapters.value.push(newCh);
            triggerRef(chapters);
          }

          // Открываем вкладку новой главы
          openChapterTab(newCh);
        } catch (e) {
          addLog(`Manuscript -> Error creating chapter: ${e}`, 'error');
        } finally {
          isCreatingChapter = false;
        }
      };

      const deleteChapter = async (chapter: any, silent = false) => {
        if (!silent && !confirm(`Удалить главу "${chapter.title}"?`)) return;
        try {
          await apiService.deleteChapter(projectName, chapter.id);
          addLog(`Manuscript -> Deleted chapter [${chapter.id}]`, 'warn');
          closeEditor(chapter.id, true);
          if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === chapter.id) {
            activeTreeNode.value = null;
          }
          // Обновляем дерево глав
          await chapterTreeRef.value?.load();
          addToast(`Глава "${chapter.title}" удалена`, 'warn');
        } catch (e) {
          addLog(`Manuscript -> Error deleting chapter: ${e}`, 'error');
        }
      };

      const mountEntityEditor = (id: string) => {
        // Vue is declarative now. The `<entity-editor-vue>` component handles mounting based on `activeEditor`.
        // This function stub can be used for UI side effects if necessary.
      };

      const renameChapter = async (chapter: any, newTitle: string) => {
        try {
          eg.updateTabData(chapter.id, { title: newTitle });
          const fullData = await apiService.getChapter(projectName, chapter.id);
          fullData.title = newTitle;
          await apiService.saveChapter(projectName, fullData);
          addLog(`Chapter renamed: ${newTitle}`, 'success');
        } catch (e) {
          console.error('Failed to rename chapter:', e);
          addLog(`Error renaming chapter: ${e}`, 'error');
        }
      };

      const closeEditor = (id: string, force = false) => {
        eg.closeTab(id, force);
        addLog(`Editor -> Closed [${id}]`, 'warn');
      };

      const deleteEntity = async (tabId: string, entityType: string, silent = false) => {
        if (!silent && !confirm(`Удалить эту запись безвозвратно?`)) return;
        // Чистый ID = часть после двоеточия (character:3 → 3)
        const colonIdx = tabId.indexOf(':');
        const rawId = colonIdx > -1 ? tabId.slice(colonIdx + 1) : tabId;
        try {
          await apiService.deleteEntity(projectName, entityType, rawId);
          // Закрываем вкладку если открыта
          closeEditor(tabId, true);
          if (activeTreeNode.value && activeTreeNode.value.type === entityType && activeTreeNode.value.node.id === rawId) {
            activeTreeNode.value = null;
          }
          if (currentSidebarTab.value) {
            await loadEntityList(currentSidebarTab.value);
          }
          if (chapterTreeRef.value) chapterTreeRef.value.load();
          addToast(`Запись удалена`, 'warn');
        } catch (e) {
          addLog(`Entity -> Delete error: ${e}`, 'error');
        }
      };

      const deleteVolume = async (volume: any, chaptersInVol: any[] = [], arcsInVol: any[] = [], silent: boolean = false) => {
        console.log('🔴 deleteVolume called:', { volume, chaptersInVolCount: chaptersInVol.length, arcsInVolCount: arcsInVol.length, openEditorsCount: openEditors.value.length });
        console.log('📑 chaptersInVol:', chaptersInVol);
        console.log('📋 openEditors:', openEditors.value.map(e => ({ id: e.id, title: e.title })));
        
        if (!silent && !confirm(`Удалить том "${volume.title}" и все его содержимое?`)) return;
        try {
          const compareIds = (id1: any, id2: any) => {
            if (!id1 && !id2) return true;
            if (!id1 || !id2) return false;
            return String(id1.id || id1).split(':').pop() === String(id2.id || id2).split(':').pop();
          };

          // Принудительно ищем все открытые вкладки, которые относятся к этому тому или его аркам
          const editorsToClose = openEditors.value.filter(e => 
            e.tabType === 'chapter' && 
            (
              compareIds(e.data.volumeId, volume.id) || 
              arcsInVol.some(arcId => compareIds(e.data.arcId, arcId)) ||
              chaptersInVol.some(c => String(c.id) === e.id)
            )
          );
          console.log('🔴 editorsToClose:', editorsToClose.map(e => ({ id: e.id, title: e.title })));
          for (const ed of editorsToClose) {
            console.log('🔴 Closing editor:', ed.id);
            closeEditor(ed.id, true);
            if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ed.id) {
              activeTreeNode.value = null;
            }
          }

          // Удаляем все главы внутри БД
          for (const ch of chaptersInVol) {
            try {
              await apiService.deleteChapter(projectName, ch.id);
            } catch (err) {
              console.error('Ошибка удаления главы (vol):', err);
            }
            // Дублируем закрытие на всякий случай
            closeEditor(String(ch.id), true);
            if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
              activeTreeNode.value = null;
            }
          }
          // Удаляем все арки внутри
          for (const arcId of arcsInVol) {
            await apiService.deleteArc(projectName, arcId);
            if (activeTreeNode.value && activeTreeNode.value.type === 'arc' && activeTreeNode.value.node.id === arcId) {
              activeTreeNode.value = null;
            }
          }

          await apiService.deleteVolume(projectName, volume.id);
          addLog(`Deleted volume [${volume.id}]`, 'warn');
          
          if (activeTreeNode.value && activeTreeNode.value.type === 'volume' && activeTreeNode.value.node.id === volume.id) {
            activeTreeNode.value = null;
          }

          await chapterTreeRef.value?.load();
          addToast(`Том "${volume.title}" удален`, 'warn');
        } catch (e) {
          addLog(`Error deleting volume: ${e}`, 'error');
        }
      };

      const deleteArc = async (arc: any, chaptersInArc: any[] = [], silent: boolean = false) => {
        console.log('🔴 deleteArc called:', { arc, chaptersInArcCount: chaptersInArc.length, openEditorsCount: openEditors.value.length });
        console.log('📑 chaptersInArc:', chaptersInArc);
        
        if (!silent && !confirm(`Удалить арку "${arc.title}" и все ее главы?`)) return;
        try {
          const compareIds = (id1: any, id2: any) => {
            if (!id1 && !id2) return true;
            if (!id1 || !id2) return false;
            return String(id1.id || id1).split(':').pop() === String(id2.id || id2).split(':').pop();
          };

          const editorsToClose = openEditors.value.filter(e => 
            e.tabType === 'chapter' && 
            (compareIds(e.data.arcId, arc.id) || chaptersInArc.some(c => String(c.id) === e.id))
          );
          console.log('🔴 editorsToClose:', editorsToClose.map(e => ({ id: e.id, title: e.title })));
          for (const ed of editorsToClose) {
            console.log('🔴 Closing editor:', ed.id);
            closeEditor(ed.id, true);
            if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ed.id) {
              activeTreeNode.value = null;
            }
          }

          for (const ch of chaptersInArc) {
            try {
              await apiService.deleteChapter(projectName, ch.id);
            } catch (err) {
              console.error('Ошибка удаления главы (arc):', err);
            }
            closeEditor(String(ch.id), true);
            if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
              activeTreeNode.value = null;
            }
          }

          await apiService.deleteArc(projectName, arc.id);
          addLog(`Deleted arc [${arc.id}]`, 'warn');
          
          if (activeTreeNode.value && activeTreeNode.value.type === 'arc' && activeTreeNode.value.node.id === arc.id) {
            activeTreeNode.value = null;
          }

          await chapterTreeRef.value?.load();
          addToast(`Арка "${arc.title}" удалена`, 'warn');
        } catch (e) {
          addLog(`Error deleting arc: ${e}`, 'error');
        }
      };

      const markUnsaved = (tabId?: string) => {
        const id = tabId ?? activeEditor.value?.id;
        if (id) eg.markTabUnsaved(id);
      };

      const toggleEntityHistory = (rawId: string) => {
        console.log(`[app.ts] toggleEntityHistory called for rawId:`, rawId);
        document.dispatchEvent(new CustomEvent('ww:toggle-entity-history', { detail: { id: rawId } }));
      };

      const onChapterRenamed = ({ id, title }: { id: string; title: string }) => {
        eg.updateTabData(id, { title });
      };

      const markSaved = (tabId?: string) => {
        const id = tabId ?? activeEditor.value?.id;
        if (id) {
          eg.markTabSaved(id);
          addToast('Глава сохранена', 'success');
        }
      };

      // 🔴 Обработчик update-data - делает глубокий merge вместо полной перезаписи
      const handleUpdateData = (tabId: string, newData: any) => {
        const tabsToUpdate = eg.allTabs.value.filter(t => t.id === tabId);
        if (tabsToUpdate.length === 0) return;
        
        console.log(`[app.ts] 🔄 handleUpdateData вызвана для ${tabId}, merging данные в ${tabsToUpdate.length} вкладок`);
        
        // ВАЖНО: Просто мержим без изменений - schema определяет хранение
        const merge = (target: any, source: any) => {
          for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
              if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
              }
              merge(target[key], source[key]);
            } else if (Array.isArray(source[key])) {
              if (!Array.isArray(target[key])) {
                target[key] = [];
              }
              
              for (let i = 0; i < source[key].length; i++) {
                if (i < target[key].length) {
                  if (typeof source[key][i] === 'object' && source[key][i] !== null) {
                    merge(target[key][i], source[key][i]);
                  } else {
                    target[key][i] = source[key][i];
                  }
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
            // ВАЖНО: НЕ мержим __foreignUpdates в tab.data!
            // Это внутренное состояние EntityEditor и его попадание в tab.data
            // вызывает бесконечный цикл: handleUpdateData → initialData change → watch → markModified → повтор.
            const { __foreignUpdates, ...dataToMerge } = newData as any;
            merge(tab.data, dataToMerge);
            // Храним __foreignUpdates отдельно от tab.data, чтобы saveAll мог их прочитать
            if (__foreignUpdates && Object.keys(__foreignUpdates).length > 0) {
                (tab as any)._foreignUpdates = __foreignUpdates;
            }
        }
      };

      const saveAll = async () => {
        let savedCount = 0;
        for (const editor of openEditors.value) {
          if (!editor.unsaved) continue;
          
          if (editor.tabType === 'chapter') {
            document.dispatchEvent(new CustomEvent('ww:trigger-chapter-save'));
            continue;
          }
          try {
            console.log(`[saveAll] === НАЧАЛО СОХРАНЕНИЯ ${editor.entityType} ${editor.id} ===`);
            console.log(`[saveAll] editor.data ДО сохранения:`, {
              keys: Object.keys(editor.data),
              characterRelationships: (editor.data as any).characterRelationships,
              familyRelations: (editor.data as any).familyRelations,
              foreignUpdates: (editor.data as any).__foreignUpdates ? Object.keys((editor.data as any).__foreignUpdates).length : 0
            });
            
            // Проверяем что именно будет отправлено
            const dataToSave = editor.data as any;
            const charRelArray = dataToSave.characterRelationships;
            if (charRelArray) {
              console.log(`[saveAll] characterRelationships тип: ${charRelArray.constructor?.name}, length: ${charRelArray.length}`);
              if (charRelArray.length > 0) {
                console.log(`[saveAll] первый элемент characterRelationships:`, charRelArray[0]);
              }
            }
            // 🔄 СИНХРОНИЗАЦИЯ ДАННЫХ НА ОСНОВЕ JSON-СХЕМЫ (БЕЗ ХАРДКОДА)
            // Это синхронизирует вложенные массивы (например, динамика_отношений -> relationshipStates)
            // согласно настройкам из /struct/editor/${entityType}.json
            await prepareEntityForSave(editor.entityType, dataToSave);
            
            // Считываем foreignUpdates из tab._foreignUpdates
            const foreignUpdatesToProcess = (editor as any)._foreignUpdates;
            // Сбрасываем после чтения
            (editor as any)._foreignUpdates = null;
            
            // Удаляем __foreignUpdates из dataToSave если вдруг попал туда старым способом
            delete dataToSave.__foreignUpdates;
            
            // 1. Save main entity data and child tables
            console.log(`[saveAll] 🔥 ОТПРАВЛЯЮ В TAURI: ${editor.entityType} ${editor.rawId}`);
            await apiService.saveEntity(projectName, editor.entityType, dataToSave, editor.rawId, editor.title);
            console.log(`[saveAll] ✅ Сущность ${editor.entityType} ${editor.rawId} сохранена в БД`);
            
            // 2. Save relationships to Connections table
            if (connectionsManager) {
              try {
                connectionsManager.setCurrentEntity(editor.entityType, editor.rawId);
                connectionsManager.setFormData(dataToSave);
                
                // Load config for the entity type
                try {
                  connectionsManager.setCurrentProject(projectName);
                  const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
                  if (configRes.ok) {
                    const config = await configRes.json();
                    connectionsManager.setConfig(config);
                    await connectionsManager.saveConnections();
                  }
                } catch (configError) {
                  // Ignore
                }
              } catch (connError) {
                console.error(`[saveAll] Error saving connections:`, connError);
              }
            }

            // 🔥 ОБРАБОТКА ВСТРЕЧНЫХ ОТНОШЕНИЙ, ОТРЕДАКТИРОВАННЫХ ПОЛЬЗОВАТЕЛЕМ 🔥
            let foreignUpdatesFinal = foreignUpdatesToProcess || {};
            
            // --- СБОР УДАЛЕННЫХ ВСТРЕЧНЫХ СВЯЗЕЙ (ORPHAN CLEANUP) ---
            try {
              const configRes = await fetch(`/struct/editor/${editor.entityType}.json`);
              if (configRes.ok) {
                const schema = await configRes.json();
                const oldStateReq = await apiService.getEntity(projectName, editor.entityType, editor.rawId);
                const oldState = (oldStateReq as any)?.data || oldStateReq;
                
                if (oldState) {
                  for (const section of schema.sections || []) {
                    for (const dc of section.dynamicContainers || []) {
                      const tpl = schema.templates?.[dc.template];
                      if (tpl && tpl.isBidirectional) {
                        const dataPath = dc.dataPath || dc.id;
                        const linkClass = tpl.bidirectionalLinkClass;
                        // Находим поле ссылки в шаблоне, чтобы узнать entityType целевой сущности
                        let targetType = '';
                        if (tpl.fields) {
                           const targetField = tpl.fields.find((f:any) => f.class === linkClass);
                           if (targetField && targetField.entityType) {
                              targetType = targetField.entityType;
                           }
                        }
                        
                        if (linkClass && targetType) {
                          const oldArr = Array.isArray(oldState[dataPath]) ? oldState[dataPath] : 
                                         (Array.isArray(oldState[dc.id]) ? oldState[dc.id] : []);
                          const newArr = Array.isArray(dataToSave[dataPath]) ? dataToSave[dataPath] : 
                                         (Array.isArray(dataToSave[dc.id]) ? dataToSave[dc.id] : []);
                          
                          for (const oldItem of oldArr) {
                            const oldTarget = String(oldItem[linkClass] || '');
                            if (!oldTarget) continue;
                            
                            const stillExists = newArr.some((newItem: any) => String(newItem[linkClass]) === oldTarget);
                            if (!stillExists) {
                              // Был удален!
                              const targetEntityId = oldTarget;
                              const updateKey = `${targetType}:${targetEntityId}_delete`;
                              foreignUpdatesFinal[updateKey] = {
                                entityType: targetType,
                                entityId: targetEntityId,
                                data: {},
                                linkClass: linkClass,
                                backLinkValue: `entities:${editor.rawId}`,
                                __deleted: true
                              };
                              console.log(`[saveAll] 🗑️ Обнаружено удаление связи с ${targetEntityId}, планирую удаление встречной связи`);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error('[saveAll] Ошибка при поиске удаленных связей:', e);
            }

            if (foreignUpdatesFinal && Object.keys(foreignUpdatesFinal).length > 0) {
              await saveForeignRelationships(projectName, editor.rawId, foreignUpdatesFinal);
            }
            
            const newTitle = getEntityDisplayName(editor.data as Record<string, unknown>, editor.entityType);
            if (newTitle && newTitle !== editor.title) {
              editor.title = newTitle;
              if (chapterTreeRef.value) chapterTreeRef.value.load();
              if (currentSidebarTab.value === editor.entityType) {
                loadEntityList(currentSidebarTab.value);
              }
            }
            
            editor.unsaved = false;
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



      // Диалог ввода имени при создании новой сущности
      // titleFieldPath — путь из схемы (например "основное_ключ.полное_имя")


        const isCreatingEntity = ref(false);
        const addNewEntity = async (entityType: string, preDefinedName?: string) => {
          if (!entityType || isCreatingEntity.value) return;
          isCreatingEntity.value = true;
          
          try {
            // Для глав - создаём через специальную логику
            if (entityType === 'chapters') {
              const newChapterTitle = preDefinedName || prompt('Введите название новой главы:', 'Новая глава');
              if (newChapterTitle === null) {
                isCreatingEntity.value = false;
                return;
              }

              const newChapter = {
                id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: newChapterTitle || 'Новая глава',
                content: '# Начните писать\n\n',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                wordCount: 0,
                footnotes: {},
                timelineEvents: [],
                participants: []
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

            // Для обычных сущностей
            const schema = await loadSchema(entityType);
            const titleFieldPath: string =
              schema?.titleField ||
              schema?.sections?.[0]?.fields?.[0]?.path ||
              'name';

            const initialData: any = {};
            let nameToSet = preDefinedName || prompt(`Введите название для нового элемента:`, 'Без названия');
            
            if (nameToSet === null) {
              isCreatingEntity.value = false;
              return; // Пользователь отменил создание
            }

            if (nameToSet) {
              // Поддерживаем вложенные пути типа "attributes.Name"
              const parts = titleFieldPath.split('.');
              let current = initialData;
              for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = {};
                current = current[parts[i]];
              }
              current[parts[parts.length - 1]] = nameToSet;
            }

            // 1. Создаем сущность с начальными данными, чтобы получить ID от сервера
            const saveResult = await apiService.saveEntity(
              projectName, entityType, initialData, undefined, nameToSet || undefined
            );

            const newEntityId = saveResult?.id;
            if (!newEntityId || newEntityId === 'undefined') {
              addLog(`Entity -> Error: сервер не вернул валидный ID для ${entityType}`, 'error');
              addToast(`Ошибка: не удалось создать ${entityType}`, 'error');
              return;
            }

            // 2. Получаем созданную пустышку
            const newEntity = await apiService.getEntity(projectName, entityType, newEntityId);
            if (!newEntity) {
              addLog(`Entity -> Error: не удалось загрузить только что созданную сущность ${newEntityId}`, 'error');
              return;
            }
            addLog(`Entity -> Debug: newEntity keys: ${Object.keys(newEntity).join(', ')}, id: ${(newEntity as any).id}`, 'info');
            console.log('[addNewEntity] Fetched new entity:', JSON.stringify(newEntity));

            // 3. Заполняем её именем и сохраняем по-настоящему
            if (preDefinedName) {
              (newEntity as any).Name = preDefinedName;
              setValueByPath(newEntity, titleFieldPath, preDefinedName);
              
              await apiService.saveEntity(
                projectName, entityType, newEntity as any, newEntityId
              );
            }

            addLog(`Entity -> Created ${entityType} "${preDefinedName || newEntityId}"`, 'success');
            addToast(`Сущность "${preDefinedName || 'Создана'}" добавлена`, 'success');

            // Обновляем списки
            await loadEntityList(entityType);
            if (chapterTreeRef.value) chapterTreeRef.value.load();

            // Гарантируем имя для новой вкладки
            const entityToOpen = { ...newEntity, entityType };
            if (preDefinedName) (entityToOpen as any).Name = preDefinedName;
            
            if (entityToOpen.id && entityToOpen.id !== 'undefined') {
              await openEntity(entityToOpen);
            } else {
              addLog(`Entity -> Error: попытка открыть сущность с невалидным ID`, 'error');
            }
          } catch (e) {
            addLog(`Entity -> Error: ${e}`, 'error');
          } finally {
            isCreatingEntity.value = false;
          }
        };

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
          const isReverse = settings.value.layout.sidebarPos === 'row-reverse';
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

      // Ресайзер для сплит-панели (хранит % в CSS-переменной --split-left-width)
      const splitLeftWidth = ref(parseFloat(localStorage.getItem('app-split-width') || '50'));
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


      const toggleSettings = () => { showSettings.value = !showSettings.value; };

      const resetSettings = () => {
        settingsService.resetSettings();
        addLog('Settings -> Reset', 'warn');
      };

      // ─── Group resize (drag between editor groups) ─────────────────────────
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
          // Сохраняем после resize
          saveState();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      };


      // Watch activeEditor
      watch(activeEditorId, (newId) => {
        if (newId) nextTick(() => mountEntityEditor(newId as string));
      });

      // Watch for state persistence (eg.groups is reactive)
      watch([activeView, currentSidebarTab, activePanelTab, activeTreeNode], saveState);
      watch(eg.groups, saveState, { deep: true });

      // Settings watcher
      watch(() => settingsService.getSettings(), (n) => {
        settingsService.saveSettings(n);
      }, { deep: true });

      const closeAllTabs = () => eg.closeAll();

      const openTagsManager = () => tagsManagerRef.value?.open();

      const openFloatingEditor = (entityType: string, entityId: string) => {
        const id = `${entityType}:${entityId}`;
        
        // 1. Пробуем нативное окно через Tauri v2 API
        try {
          const tauri = (window as any).__TAURI__;
          if (tauri?.webviewWindow?.WebviewWindow) {
            const WebviewWindow = tauri.webviewWindow.WebviewWindow;
            const label = `entity-editor-${entityType}-${entityId}`.replace(/[^a-z0-9]/gi, '-');
            new WebviewWindow(label, {
              url: `ui_editor.html?project=${projectName}&type=${entityType}&id=${entityId}`,
              title: `Edit: ${entityType} [${entityId}]`,
              width: 950,
              height: 750,
              resizable: true,
              center: true,
              decorations: true
            });
            return;
          }
        } catch (e) {
          console.warn('Native win failed:', e);
        }
        
        // 2. Всегда запасной вариант: встроенное окно
        const existing = floatingEditors.value.find(e => e.id === id);
        if (existing) {
          focusFloatingEditor(id);
        } else {
          floatingEditors.value.push({ id, entityType, entityId, zIndex: nextZIndex.value++ });
        }
      };

      const focusFloatingEditor = (id: string) => {
        const editor = floatingEditors.value.find(e => e.id === id);
        if (editor) {
          editor.zIndex = nextZIndex.value++;
        }
      };

      const closeFloatingEditor = (id: string) => {
        floatingEditors.value = floatingEditors.value.filter(e => e.id !== id);
      };

      // Expose globally for legacy components
      (window as any).openFloatingEditor = openFloatingEditor;

      // Init
      onMounted(() => {
        // Apply saved zoom
        applyZoom(zoomLevel.value);

        // Listen to settings changes
        settingsService.onChange((newSettings) => {
          settings.value = newSettings;
        });

        window.addEventListener('keydown', (e) => {
          // ─── Блокируем браузерные дефолты для всех Ctrl-шорткатов которые мы перехватываем ───
          // e.code — физическая позиция клавиши, НЕ зависит от раскладки (рус/eng/etc)
          if (e.ctrlKey) {
            const BROWSER_OVERRIDES = new Set([
              'KeyS', 'KeyP', 'KeyN', 'KeyW', 'KeyF', 'KeyB',
              'Comma', 'Minus', 'Equal', 'Digit0', 'Backquote',
              'Tab', 'Digit1','Digit2','Digit3','Digit4','Digit5',
              'Digit6','Digit7','Digit8','Digit9', 'F11', 'KeyT',
              'Backslash',
            ]);
            if (BROWSER_OVERRIDES.has(e.code)) {
              e.preventDefault(); // блокируем браузер ВСЕГДА для этих клавиш
            }
          }

          // ─── F11 (Полноэкранный режим) ──────────────────────────────────────────
          if (e.code === 'F11') {
            e.preventDefault();
            const tauri = (window as any).__TAURI__;
            if (tauri) {
              // Вызываем через Rust команду (самый надежный способ)
              tauri.core.invoke('toggle_fullscreen').catch((err: any) => {
                console.error('Fullscreen toggle error:', err);
              });
            } else {
              // Браузерный fallback
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                  console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
                });
              } else {
                if (document.exitFullscreen) {
                  document.exitFullscreen();
                }
              }
            }
            return;
          }

          // ─── Ctrl (без Shift, без Alt) ───────────────────────────────────────────
          if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            switch (e.code) {
              case 'KeyS':        saveAll(); return;
              case 'Comma':       toggleSettings(); return;
              case 'KeyF':        (document.querySelector('.sidebar-search input') as HTMLInputElement)?.focus(); return;
              case 'KeyW':        if (activeEditorId.value) closeEditor(activeEditorId.value); return;
              case 'KeyB':        sidebarVisible.value = !sidebarVisible.value; return;
              case 'KeyP':        quickOpenRef.value?.open(); return;
              case 'KeyN':        addNewEntity(currentSidebarTab.value || ''); return;
              case 'Equal':       applyZoom(zoomLevel.value + 0.1); return;  // Ctrl+=
              case 'Minus':       applyZoom(zoomLevel.value - 0.1); return;  // Ctrl+-
              case 'Digit0':      applyZoom(1); return;                       // Ctrl+0
              case 'Backquote':   activePanelTab.value = activePanelTab.value === '' ? 'console' : ''; return;
              case 'Tab':
                if (openEditors.value.length > 1) {
                  const idx = openEditors.value.findIndex(ed => ed.id === activeEditorId.value);
                  activeEditorId.value = openEditors.value[(idx + 1) % openEditors.value.length].id;
                }
                return;
              // Ctrl+1..9 — вкладка по номеру
              case 'Digit1': case 'Digit2': case 'Digit3':
              case 'Digit4': case 'Digit5': case 'Digit6':
              case 'Digit7': case 'Digit8': case 'Digit9': {
                const n = parseInt(e.code.replace('Digit', ''));
                const tab = openEditors.value[n - 1];
                if (tab) activeEditorId.value = tab.id;
                return;
              }
              case 'Backslash': {
                e.preventDefault();
                eg.splitRight();
                addLog(`Layout -> Split added (groups: ${eg.groups.value.length})`, 'info');
                return;
              }
            }
          }

          // ─── Ctrl+Shift ──────────────────────────────────────────────────────────
          if (e.ctrlKey && e.shiftKey && !e.altKey) {
            // Блокируем браузерные дефолты для Ctrl+Shift
            if (['KeyP','KeyN','KeyS','Tab'].includes(e.code)) e.preventDefault();
            switch (e.code) {
              case 'KeyP':  commandPaletteRef.value?.open(); return;
              case 'KeyN':  createChapterIn({}); return;
              case 'KeyS':  saveAll(); return;
              case 'Tab':
                if (openEditors.value.length > 1) {
                  const idx = openEditors.value.findIndex(ed => ed.id === activeEditorId.value);
                  const prev = (idx - 1 + openEditors.value.length) % openEditors.value.length;
                  activeEditorId.value = openEditors.value[prev].id;
                }
                return;
              case 'KeyT':  openTagsManager(); return;
              case 'KeyB':  document.dispatchEvent(new CustomEvent('ww:toggle-chapter-right-panel')); return;
            }
          }

          // ─── Alt+1..9 — переключить секцию внутри сущности ──────────────────────
          if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            const match = e.code.match(/^Digit([1-9])$/);
            if (match) {
              e.preventDefault();
              document.dispatchEvent(new CustomEvent('ww:switch-section', { detail: parseInt(match[1]) - 1 }));
              return;
            }
          }

          // ─── Ctrl+Alt — горячие клавиши для панелей ────────────────────────────────
          if (e.ctrlKey && e.altKey && !e.shiftKey) {
            console.log('🔥 Ctrl+Alt нажата, код:', e.code);
            if (e.code === 'KeyB') {
              e.preventDefault();
              console.log('✅ Ctrl+Alt+B - toggle right panel');
              const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
              localStorage.setItem('chapters-right-panel-visible', (!isHidden).toString());
              console.log('💾 localStorage chapters-right-panel-visible:', (!isHidden).toString());
              document.dispatchEvent(new CustomEvent('ww:toggle-right-panel'));
              return;
            }
          }

          // ─── Ctrl+R — структура ──────────────────────────────────────────────────────
          if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === 'KeyR') {
            e.preventDefault();
            console.log('✅ Ctrl+R/К - toggle structure');
            const storedValue = localStorage.getItem('split-view-show-structure');
            const shouldShow = storedValue !== 'false'; // 'true' или null = показать, 'false' = скрыть
            const newState = !shouldShow; // инвертируем текущее состояние
            localStorage.setItem('split-view-show-structure', newState.toString());
            console.log('💾 localStorage split-view-show-structure:', newState.toString(), '(was:', storedValue, ')');
            document.dispatchEvent(new CustomEvent('ww:toggle-structure'));
            return;
          }

          // ─── Escape ────────────────  ──────────────────────────────────────────────
          if (e.code === 'Escape') {
            if (showSettings.value) { showSettings.value = false; return; }
          }
        });

        addLog('System -> Glass Engine v3 initialized', 'success');
        addLog(`System -> Project: ${projectName}`, 'info');

        restoreState().then(restored => {
          if (!restored) {
            // Загружаем первый entity type только если нечего восстанавливать
            const firstEntity = sidebarItems.find(i => i.type === 'entity');
            if (firstEntity) {
              currentSidebarTab.value = firstEntity.entityType!;
              loadEntityList(firstEntity.entityType!);
            }
          } else {
            // Если восстановили, всё равно подгрузим список для текущего таба
            if (currentSidebarTab.value && currentSidebarTab.value !== 'chapters') {
              loadEntityList(currentSidebarTab.value);
            } else if (currentSidebarTab.value === 'chapters') {
              loadChapters();
            }
          }
        });
      });

      const quickOpenDataSource = async (): Promise<any[]> => {
        const items: any[] = [];
        try {
          const list = await apiService.getChaptersList(projectName);
          for (const c of list as Array<any>) {
            items.push({
              id: `chapter_${c.id}`,
              rawId: String(c.id),
              title: c.title || `Глава ${c.id}`,
              typeLabel: 'Глава',
              entityType: 'chapter',
              emoji: '📝',
              data: c
            });
          }
        } catch(e) {}

        for (const tab of sidebarItems) {
          if (tab.type === 'entity' && tab.entityType) {
            try {
              const list = await apiService.getEntityList(projectName, tab.entityType);
              for (const e of list as Array<any>) {
                items.push({
                  id: `entity_${tab.entityType}_${e.id}`,
                  rawId: String(e.id),
                  title: getEntityDisplayName(e, tab.entityType),
                  typeLabel: tab.title,
                  entityType: tab.entityType,
                  emoji: tab.icon || '📄',
                  data: {...e, entityType: tab.entityType} // В openEntity нужен entityType
                });
              }
            } catch(e) {}
          }
        }
        return items;
      };

      const handleQuickOpenSelect = (item: any) => {
        if (item.entityType === 'chapter') {
          openChapterTab(item.data);
        } else {
          openEntity(item.data);
        }
      };

      return {
        projectName, activeView, currentSidebarTab, showSettings, sidebarSearch, activePanelTab,
        openEditors, activeEditorId, activeEditor, activeEntityRawId, consoleLogs, activeField, panelHeight, sidebarWidth,
        sidebarItems, activeSidebarItem, filteredEntityList, chapters, chapterTreeRef,
        sidebarVisible, zoomLevel, quickOpenRef, commandPaletteRef,
        settings, toasts, addToast, getToastIcon,
        selectSidebarTab, openEntity, openSchemaEditor, openChapterTab, closeEditor, markUnsaved, markSaved, saveAll, closeAllTabs,
        addNewEntity, startResize, startSidebarResize, toggleSettings, resetSettings, addLog, handleUpdateData,
        getEntityDisplayName, deleteEntity, deleteVolume, deleteArc, createChapterIn, deleteChapter, renameChapter, activeTreeNode, applyZoom,
        quickOpenDataSource, handleQuickOpenSelect,
        selectTreeNode: (node: any) => { activeTreeNode.value = node; },
        handleScrollChange: (groupId: string, tabId: string, scroll: number) => {
          const group = eg.groups.value.find(g => g.id === groupId);
          const tab = group?.tabs.find(t => t.id === tabId);
          if (tab) {
            tab.scrollPos = scroll;
            saveState();
          }
        },
        handleSectionChange: (groupId: string, tabId: string, sectionId: string) => {
          const group = eg.groups.value.find(g => g.id === groupId);
          const tab = group?.tabs.find(t => t.id === tabId);
          if (tab) {
            tab.activeSection = sectionId;
            const newTitle = getEntityDisplayName(tab.data as Record<string, unknown>, tab.entityType);
            if (newTitle && newTitle !== tab.title) {
              tab.title = newTitle;
              if (chapterTreeRef.value) chapterTreeRef.value.load();
              if (currentSidebarTab.value === tab.entityType) {
                loadEntityList(currentSidebarTab.value);
              }
            }
            saveState();
          }
        },
        openQuickOpen: () => quickOpenRef.value?.open(),
        tagsManagerRef,
        openTagsManager: () => tagsManagerRef.value?.open(),
        floatingEditors,
        openFloatingEditor,
        closeFloatingEditor,
        focusFloatingEditor,
        onChapterRenamed,
        toggleEntityHistory,
        openSandbox: () => { activeView.value = 'sandbox'; sidebarVisible.value = false; },
        // ─── Editor Groups API (для шаблона) ───
        editorGroups: eg.groups,
        activeGroupId: eg.activeGroupId,
        splitRight: () => eg.splitRight(),
        closeGroup: (gid: string) => eg.removeGroup(gid),
        moveTab: (p: any) => eg.moveTab(p.tabId, p.toGroupId, p.toIndex),
        reorderTab: (p: any) => eg.reorderTab(p.groupId, p.fromIdx, p.toIdx),
        activateTabInGroup: (gid: string, tid: string) => {
          const g = eg.groups.value.find(g => g.id === gid);
          if (g) { g.activeTabId = tid; eg.activeGroupId.value = gid; }
        },
        focusGroup: (gid: string) => { eg.activeGroupId.value = gid; },
        startGroupResize,
      };
    }
  });

  app.component('entity-editor-vue', EntityEditorVue);
  app.component('chapters-view-vue', ChaptersViewVue);
  app.component('chapters-main-vue', ChaptersMainVue);
  app.component('chapter-tree-vue', ChapterTreeVue);
  app.component('editor-core-vue', EditorCoreVue);
  app.component('timeline-panel-vue', TimelinePanelVue);
  app.component('participants-panel-vue', ParticipantsPanelVue);
  app.component('planning-panel-vue', PlanningPanelVue);
  app.component('export-modal-vue', ExportModalVue);
  app.component('wowilon-drawer-vue', WowilonDrawerVue);
  app.component('quick-open-vue', QuickOpenVue);
  app.component('command-palette-vue', CommandPaletteVue);
  app.component('tags-manager-modal-vue', TagsManagerModalVue);
  app.component('tags-field-vue', TagsField);
  app.component('floating-entity-editor-vue', FloatingEntityEditorVue);
  app.component('redact-sandbox-vue', RedactSandboxVue);
  app.component('schema-editor-main-vue', SchemaEditorMainVue);
  app.component('editor-tab-bar-vue', EditorTabBarVue);
  app.component('editor-group-pane-vue', EditorGroupPaneVue);
  app.component('cloud-sync-modal-vue', CloudSyncModalVue);
  app.use(autoAnimatePlugin);
  app.use(MotionPlugin);
  app.use(i18n as unknown as Plugin).mount('#app');
}

init().catch(e => console.error('[app] init error:', e));

