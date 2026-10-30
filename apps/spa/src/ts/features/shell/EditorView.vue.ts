import { defineComponent, computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useShellStore } from '@/stores/shell';
import { useConsoleStore } from '@/stores/console';
import { useSchemaStore } from '@/stores/schema';
import { useHotkeysStore } from '@/stores/hotkeys';
import { useEditorViewListeners } from './useEditorViewListeners';
export type { ConsoleLog, SidebarItem, EditorGroup, EditorTab } from '@/stores/shell';

// Component imports for template
import ChapterTreeVue from '@/features/chapters/ChapterTree/ChapterTree.vue';

import { EditorGroupPane as EditorGroupPaneVue } from '@worldwiki/components';
import ChaptersMainVue from '@/features/chapters/ChaptersMain/ChaptersMain.vue';
import EntityEditorVue from '@/features/entities/EntityEditor/EntityEditor.vue';
import SchemaEditorMainVue from '@/features/schemas/SchemaEditor/SchemaEditorMain.vue';
import { AppDialog, QuickOpen as QuickOpenVue, CommandPalette as CommandPaletteVue, Settings as SettingsVue } from '@worldwiki/components';
import TagsManagerModalVue from '@/features/entities/TagsManagerModal.vue';
import CreateChapterModalVue from '@/features/chapters/CreateChapterModal/CreateChapterModal.vue';
import WowilonPanelVue from '@/features/ai/WowilonPanel.vue';
import CrossReferenceMatrixVue from '@/features/analytics/CrossReferenceMatrix/CrossReferenceMatrix.vue';
import ConsistencyCheckerVue from '@/features/analytics/ConsistencyChecker/ConsistencyChecker.vue';
import ChekhovGunTrackerVue from '@/features/analytics/ChekhovGunTracker/ChekhovGunTracker.vue';
import ArcBoardVue from '@/features/chapters/StoryArcs/ArcBoard.vue';
import TimelineInspectorVue from '@/features/timeline/TimelineInspector/TimelineInspector.vue';
import GraphWebViewVue from '@/features/entities/GraphWeb/GraphWebView.vue';
import SurrealConsoleVue from '@/features/devtools/SurrealConsole/SurrealConsole.vue';
import CalendarEditorVue from '@/features/timeline/CalendarEditor/CalendarEditor.vue';
import PlanetEditorVue from '@/features/timeline/PlanetEditor/PlanetEditor.vue';
import type { PlanetDto } from '@/features/timeline/PlanetEditor/PlanetEditor.model';

export default defineComponent({
  name: 'EditorView',
  components: {
    ChapterTreeVue,
    EditorGroupPaneVue,
    ChaptersMainVue,
    EntityEditorVue,
    CalendarEditorVue,
    PlanetEditorVue,
    SchemaEditorMainVue,
    CrossReferenceMatrixVue,
    ConsistencyCheckerVue,
    ChekhovGunTrackerVue,
    ArcBoardVue,
    TimelineInspectorVue,
    GraphWebViewVue,
    SurrealConsoleVue,
    QuickOpenVue,
    CommandPaletteVue,
    TagsManagerModalVue,
    CreateChapterModalVue,
    SettingsVue,
    WowilonPanelVue,
    AppDialog,
  },
   
  setup() {
    const route = useRoute();
    const rawProject = typeof route.query.project === 'string' ? route.query.project : 'default';
    const routeProject = rawProject.trim() === '' ? 'default' : rawProject;

    const shell = useShellStore();
    const console = useConsoleStore();
    const schema = useSchemaStore();
    const hotkeys = useHotkeysStore();

    useEditorViewListeners({ shell });

    onMounted(() => {
      shell.quickOpenRef = quickOpenRef.value;
      shell.commandPaletteRef = commandPaletteRef.value;
      shell.tagsManagerRef = tagsManagerRef.value;
      shell.chapterTreeRef = chapterTreeRef.value;
      hotkeys.register();

      // Восстанавливаем состояние (открытые вкладки, скролл, боковую панель)
      shell.restoreState();
    });

    onUnmounted(() => {
      hotkeys.unregister();
    });

    // Initialize shell with project name
    shell.projectName = routeProject;
    shell.sidebarItems = [];

    watch(() => route.query.project, async (newProj) => {
      const p = typeof newProj === 'string' && newProj.trim() !== '' ? newProj : 'default';
      if (shell.projectName !== p) {
        shell.projectName = p;
        await shell.restoreState();
      }
    });

    // Computed refs for template reactivity
    const projectName = computed(() => shell.projectName);
    const activeView = computed(() => shell.activeView);
    const currentSidebarTab = computed(() => shell.currentSidebarTab);
    const showSettings = computed(() => shell.showSettings);
    const sidebarSearch = computed(() => shell.sidebarSearch);
    const activePanelTab = computed(() => shell.activePanelTab);
    const openEditors = computed(() => shell.openEditors);
    const activeEditorId = computed(() => shell.activeEditorId);
    const activeEditor = computed(() => shell.activeEditor);
    const activeEntityRawId = computed(() => shell.activeEntityRawId);
    const consoleLogs = computed(() => shell.consoleLogs);
    const activeField = computed(() => shell.activeField);
    const panelHeight = computed(() => shell.panelHeight);
    const sidebarWidth = computed(() => shell.sidebarWidth);
    const sidebarItems = computed(() => shell.sidebarItems);
    const activeSidebarItem = computed(() => shell.activeSidebarItem);
    const filteredEntityList = computed(() => shell.filteredEntityList);
    const chapters = computed(() => shell.chapters);
    const chapterTreeRef = ref<{ reload?: () => Promise<void> } | null>(null);
    const sidebarVisible = computed(() => shell.sidebarVisible);
    const zoomLevel = computed(() => shell.zoomLevel);
    const quickOpenRef = ref<{ open: () => void; close?: () => void } | null>(null);
    const commandPaletteRef = ref<{ open: () => void; close?: () => void } | null>(null);
    const tagsManagerRef = ref<{ open: () => void; close?: () => void } | null>(null);
    const unsavedCount = computed(() => shell.unsavedCount);
    const settings = computed(() => shell.settings);
    const toasts = computed(() => console.toasts);
    const activeTreeNode = computed(() => shell.activeTreeNode);
    const editorGroups = computed(() => shell.editorGroups);
    const activeGroupId = computed(() => shell.activeGroupId);
    
    const isWowilonOpen = computed(() => shell.isWowilonOpen);

    // Methods - direct references from store
    const selectSidebarTab = shell.selectSidebarTab;
    const openEntity = shell.openEntity;
    const openPlanetViewer = (planet: Record<string, unknown>) => {
      const id = String(planet.id ?? '');
      const title = typeof planet.name === 'string' ? planet.name : undefined;
      openEntity({ ...planet, entityType: 'planet', id, title });
    };
    const openSchemaEditor = shell.openSchemaEditor;
    const openChapterTab = shell.openChapterTab;
    const closeEditor = shell.closeEditor;
    const markUnsaved = shell.markUnsaved;
    const markSaved = shell.markSaved;
    const saveAll = shell.saveAll;
    const closeAllTabs = shell.closeAllTabs;
    const addNewEntity = shell.addNewEntity;
    const startResize = shell.startResize;
    const startSidebarResize = shell.startSidebarResize;
    const startSplitResize = shell.startSplitResize;
    const startGroupResize = shell.startGroupResize;
    const toggleSettings = shell.toggleSettings;
    const resetSettings = shell.resetSettings;
    const addLog = shell.addLog;
    const handleUpdateData = shell.handleUpdateData;
    const handleUpdatePlanetName = (tabId: string, newName: string) => {
      for (const group of shell.editorGroups) {
        for (const tab of group.tabs) {
          if (tab.id === tabId) {
            tab.title = newName;
          }
        }
      }
    };
    const handleUpdateCalendarName = (tabId: string, newName: string) => {
      for (const group of shell.editorGroups) {
        for (const tab of group.tabs) {
          if (tab.id === tabId) {
            tab.title = newName;
          }
        }
      }
    };
    const handleUpdatePlanet = (tabId: string, planetData: PlanetDto | Record<string, unknown>) => {
      handleUpdateData(tabId, planetData as unknown as Record<string, unknown>);
    };
    const getEntityDisplayName = schema.getEntityDisplayName;
    const deleteEntity = shell.deleteEntity;
    const deleteVolume = shell.deleteVolume;
    const createChapterIn = shell.createChapterIn;
    const deleteChapter = shell.deleteChapter;
    const renameChapter = shell.renameChapter;
    const renameEntity = shell.renameEntity;
    const applyZoom = shell.applyZoom;
    const quickOpenDataSource = shell.quickOpenDataSource;
    const handleQuickOpenSelect = shell.handleQuickOpenSelect;
    const selectTreeNode = shell.selectTreeNode;
    const handleScrollChange = shell.handleScrollChange;
    const handleSectionChange = shell.handleSectionChange;
    const openQuickOpen = shell.openQuickOpen;
    const openTagsManager = shell.openTagsManager;
    const openFloatingEditor = shell.openFloatingEditor;
    const onChapterRenamed = shell.onChapterRenamed;
    const toggleEntityHistory = shell.toggleEntityHistory;
    const openSandbox = shell.openSandbox;
    const splitRight = shell.splitRight;
    const closeGroup = shell.closeGroup;
    const moveTab = shell.moveTab;
    const reorderTab = shell.reorderTab;
    const activateTabInGroup = shell.activateTabInGroup;
    const focusGroup = shell.focusGroup;

    // Toast helpers
    const addToast = console.addToast;
    const getToastIcon = console.getToastIcon;

    const onGroupCloseTab = (_g: unknown, t: string) => closeEditor(t);

    // Refs are synced to shell store in onMounted

    return {
      // Refs
      chapterTreeRef,
      quickOpenRef,
      commandPaletteRef,
      tagsManagerRef,

      // State (computed for reactivity)
      projectName,
      activeView,
      currentSidebarTab,
      showSettings,
      sidebarSearch,
      activePanelTab,
      openEditors,
      activeEditorId,
      activeEditor,
      activeEntityRawId,
      consoleLogs,
      activeField,
      panelHeight,
      sidebarWidth,
      sidebarItems,
      activeSidebarItem,
      filteredEntityList,
      chapters,
      sidebarVisible,
      zoomLevel,
      unsavedCount,
      settings,
      toasts,
      activeTreeNode,
      editorGroups,
      activeGroupId,
      isWowilonOpen,
      
      toggleWowilon: () => { shell.isWowilonOpen = !shell.isWowilonOpen; },
      setActivePanelTab: (tab: string) => { shell.activePanelTab = tab; },
      togglePanel: () => { shell.activePanelTab = shell.activePanelTab === '' ? 'console' : ''; },
      toggleSidebar: () => { shell.sidebarVisible = !shell.sidebarVisible; },

      // Methods
      selectSidebarTab,
      openEntity,
      openPlanetViewer,
      openSchemaEditor,
      openChapterTab,
      closeEditor,
      markUnsaved,
      markSaved,
      saveAll,
      closeAllTabs,
      addNewEntity,
      startResize,
      startSidebarResize,
      startSplitResize,
      startGroupResize,
      toggleSettings,
      resetSettings,
      addLog,
      handleUpdateData,
      handleUpdatePlanetName,
      handleUpdateCalendarName,
      handleUpdatePlanet,
      getEntityDisplayName,
      deleteEntity,
      deleteVolume,
      createChapterIn,
      isCreateChapterModalOpen: computed(() => shell.isCreateChapterModalOpen),
      createChapterTargetVolumeId: computed(() => shell.createChapterTargetVolumeId),
      closeCreateChapterModal: shell.closeCreateChapterModal,
      confirmCreateChapter: shell.confirmCreateChapter,
      deleteChapter,
      renameChapter,
      renameEntity,
      applyZoom,
      paletteCommands: shell.paletteCommands,
      openCommandPalette: shell.openCommandPalette,
      quickOpenDataSource,
      handleQuickOpenSelect,
      selectTreeNode,
      handleScrollChange,
      handleSectionChange,
      openQuickOpen,
      openTagsManager,
      openFloatingEditor,
      onChapterRenamed,
      toggleEntityHistory,
      openSandbox,
      splitRight,
      closeGroup,
      moveTab,
      reorderTab,
      activateTabInGroup,
      focusGroup,
      onGroupCloseTab,

      // Toast helpers
      addToast,
      getToastIcon,
    };
  },
});
