import { defineComponent, computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useShellStore } from '@/stores/shell';
import { useConsoleStore } from '@/stores/console';
import { useZoomStore } from '@/stores/zoom';
import { useSchemaStore } from '@/stores/schema';
import { useFloatingStore } from '@/stores/floating';
import { useHotkeysStore } from '@/stores/hotkeys';
export type { ConsoleLog, SidebarItem, EditorGroup, EditorTab } from '@/stores/shell';

// Component imports for template
import ChapterTreeVue from '@/components/Vue/Chapters/ChapterTree.vue';
import { EditorGroupPane as EditorGroupPaneVue } from '@worldwiki/components';
import ChaptersMainVue from '@/components/Vue/Chapters/ChaptersMain.vue';
import EntityEditorVue from '@/features/entities/EntityEditor/EntityEditor.vue';
import SchemaEditorMainVue from '@/components/Vue/SchemaEditor/SchemaEditorMain.vue';
import { QuickOpen as QuickOpenVue } from '@worldwiki/components';
import { CommandPalette as CommandPaletteVue } from '@worldwiki/components';
import TagsManagerModalVue from '@/components/Vue/TagsManagerModal.vue';

export default defineComponent({
  name: 'EditorView',
  components: {
    ChapterTreeVue,
    EditorGroupPaneVue,
    ChaptersMainVue,
    EntityEditorVue,
    SchemaEditorMainVue,
    QuickOpenVue,
    CommandPaletteVue,
    TagsManagerModalVue,
  },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  setup(): Record<string, any> {
    const route = useRoute();
    const routeProject = typeof route.query.project === 'string' ? route.query.project : 'default';

    const shell = useShellStore();
    const console = useConsoleStore();
    const zoom = useZoomStore();
    const schema = useSchemaStore();
    const floating = useFloatingStore();
    const hotkeys = useHotkeysStore();

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

    // Computed refs for template reactivity
    const projectName = computed(() => shell.projectName);
    const activeView = computed(() => shell.activeView);
    const currentSidebarTab = computed(() => shell.currentSidebarTab);
    const showSettings = computed(() => shell.showSettings);
    const sidebarSearch = computed(() => shell.sidebarSearch);
    const activePanelTab = computed(() => shell.activePanelTab);
    const openEditors = computed(() => shell.openEditors as any);
    const activeEditorId = computed(() => shell.activeEditorId);
    const activeEditor = computed(() => shell.activeEditor as any);
    const activeEntityRawId = computed(() => shell.activeEntityRawId);
    const consoleLogs = computed(() => shell.consoleLogs as any);
    const activeField = computed(() => shell.activeField);
    const panelHeight = computed(() => shell.panelHeight);
    const sidebarWidth = computed(() => shell.sidebarWidth);
    const sidebarItems = computed(() => shell.sidebarItems as any);
    const activeSidebarItem = computed(() => shell.activeSidebarItem as any);
    const filteredEntityList = computed(() => shell.filteredEntityList);
    const chapters = computed(() => shell.chapters);
    const chapterTreeRef = ref<any>(null);
    const sidebarVisible = computed(() => shell.sidebarVisible);
    const zoomLevel = computed(() => shell.zoomLevel);
    const quickOpenRef = ref<any>(null);
    const commandPaletteRef = ref<any>(null);
    const tagsManagerRef = ref<any>(null);
    const unsavedCount = computed(() => shell.unsavedCount);
    const settings = computed(() => shell.settings);
    const toasts = computed(() => console.toasts);
    const activeTreeNode = computed(() => shell.activeTreeNode);
    const editorGroups = computed(() => shell.editorGroups as any);
    const activeGroupId = computed(() => shell.activeGroupId);

    // Methods - direct references from store
    const selectSidebarTab = shell.selectSidebarTab;
    const openEntity = shell.openEntity;
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
    const getEntityDisplayName = schema.getEntityDisplayName;
    const deleteEntity = shell.deleteEntity;
    const deleteVolume = shell.deleteVolume;
    const deleteArc = shell.deleteArc;
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

    const onGroupCloseTab = (g: any, t: any) => closeEditor(t);

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

      // Methods
      selectSidebarTab,
      openEntity,
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
      getEntityDisplayName,
      deleteEntity,
      deleteVolume,
      deleteArc,
      createChapterIn,
      deleteChapter,
      renameChapter,
      renameEntity,
      applyZoom,
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
