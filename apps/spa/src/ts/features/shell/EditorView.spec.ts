import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, h } from 'vue';
import { mount } from '@vue/test-utils';
import EditorView from './EditorView.vue.ts';

const mockRoute = reactive<{ query: Record<string, unknown> }>({
  query: { project: 'my-world' }
});

const mockShell = reactive({
  projectName: '',
  activeView: 'chapters',
  currentSidebarTab: 'chapters',
  showSettings: false,
  sidebarSearch: '',
  activePanelTab: '',
  openEditors: [],
  activeEditorId: null,
  activeEditor: null,
  activeEntityRawId: null,
  consoleLogs: [],
  activeField: null,
  panelHeight: 200,
  sidebarWidth: 260,
  sidebarItems: [],
  activeSidebarItem: null,
  filteredEntityList: [],
  chapters: [],
  sidebarVisible: true,
  zoomLevel: 100,
  unsavedCount: 0,
  settings: {},
  activeTreeNode: null,
  editorGroups: [],
  activeGroupId: 'g1',
  isWowilonOpen: false,
  isCreateChapterModalOpen: false,
  createChapterTargetVolumeId: null,
  isCreateEntityModalOpen: false,
  createEntityTargetType: null,
  paletteCommands: [],
  quickOpenRef: null as unknown,
  commandPaletteRef: null as unknown,
  tagsManagerRef: null as unknown,
  chapterTreeRef: null as unknown,
  restoreState: vi.fn(async () => {}),
  selectSidebarTab: vi.fn(),
  openEntity: vi.fn(),
  openSchemaEditor: vi.fn(),
  openChapterTab: vi.fn(),
  closeEditor: vi.fn(),
  markUnsaved: vi.fn(),
  markSaved: vi.fn(),
  saveAll: vi.fn(),
  closeAllTabs: vi.fn(),
  addNewEntity: vi.fn(),
  startResize: vi.fn(),
  startSidebarResize: vi.fn(),
  startSplitResize: vi.fn(),
  startGroupResize: vi.fn(),
  toggleSettings: vi.fn(),
  resetSettings: vi.fn(),
  addLog: vi.fn(),
  handleUpdateData: vi.fn(),
  updateTabTitle: vi.fn(),
  deleteEntity: vi.fn(),
  deleteVolume: vi.fn(),
  createChapterIn: vi.fn(),
  closeCreateChapterModal: vi.fn(),
  confirmCreateChapter: vi.fn(),
  closeCreateEntityModal: vi.fn(),
  confirmCreateEntity: vi.fn(),
  deleteChapter: vi.fn(),
  renameChapter: vi.fn(),
  renameEntity: vi.fn(),
  applyZoom: vi.fn(),
  openCommandPalette: vi.fn(),
  quickOpenDataSource: vi.fn(),
  handleQuickOpenSelect: vi.fn(),
  selectTreeNode: vi.fn(),
  handleScrollChange: vi.fn(),
  handleSectionChange: vi.fn(),
  openQuickOpen: vi.fn(),
  openTagsManager: vi.fn(),
  openFloatingEditor: vi.fn(),
  onChapterRenamed: vi.fn(),
  toggleEntityHistory: vi.fn(),
  openSandbox: vi.fn(),
  splitRight: vi.fn(),
  closeGroup: vi.fn(),
  moveTab: vi.fn(),
  reorderTab: vi.fn(),
  activateTabInGroup: vi.fn(),
  focusGroup: vi.fn()
});

const mockConsole = reactive({
  toasts: [],
  addToast: vi.fn(),
  getToastIcon: vi.fn(() => 'info')
});

const mockSchema = {
  getEntityDisplayName: vi.fn(() => 'Display')
};

const mockHotkeys = {
  register: vi.fn(),
  unregister: vi.fn()
};

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute
}));

vi.mock('@/stores/shell', () => ({
  useShellStore: () => mockShell
}));

vi.mock('@/stores/console', () => ({
  useConsoleStore: () => mockConsole
}));

vi.mock('@/stores/schema', () => ({
  useSchemaStore: () => mockSchema
}));

vi.mock('@/stores/hotkeys', () => ({
  useHotkeysStore: () => mockHotkeys
}));

vi.mock('./useEditorViewListeners', () => ({
  useEditorViewListeners: vi.fn()
}));

describe('EditorView.vue.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRoute.query = { project: 'my-world' };
    mockShell.projectName = '';
    mockShell.activePanelTab = '';
    mockShell.sidebarVisible = true;
    mockShell.isWowilonOpen = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mountEditorView() {
    return mount({
      ...EditorView,
      render: () => h('div')
    });
  }

  it('initializes project from route, registers hotkeys, restores state, and reacts to route changes', async () => {
    const wrapper = mountEditorView();

    expect(mockShell.projectName).toBe('my-world');
    expect(mockHotkeys.register).toHaveBeenCalledTimes(1);
    expect(mockShell.restoreState).toHaveBeenCalledTimes(1);

    mockRoute.query = { project: 'second-world' };
    await wrapper.vm.$nextTick();
    expect(mockShell.projectName).toBe('second-world');
    expect(mockShell.restoreState).toHaveBeenCalledTimes(2);

    // Blank query falls back to 'default'
    mockRoute.query = { project: '   ' };
    await wrapper.vm.$nextTick();
    expect(mockShell.projectName).toBe('default');

    wrapper.unmount();
    expect(mockHotkeys.unregister).toHaveBeenCalledTimes(1);
  });

  it('handles planet viewer, locate from tracker, updates, toggles, and tab close', () => {
    const wrapper = mountEditorView();
    const vm = wrapper.vm as unknown as Record<string, (...args: unknown[]) => unknown>;

    vm.openPlanetViewer({ id: 'pl-1', name: 'Земля' });
    expect(mockShell.openEntity).toHaveBeenCalledWith({
      id: 'pl-1',
      name: 'Земля',
      entityType: 'planet',
      title: 'Земля'
    });

    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    document.addEventListener('ww:locate-promise', listener);

    mockShell.activePanelTab = 'promises';
    vm.handleLocateFromTracker({
      chapterId: 'ch-1',
      paragraphIndex: 3,
      quote: 'Цитата',
      blockId: 'blk-1'
    });

    expect(mockShell.openChapterTab).toHaveBeenCalledWith('ch-1');
    expect(mockShell.activePanelTab).toBe('');
    expect(events).toHaveLength(1);
    vi.advanceTimersByTime(700);
    expect(events).toHaveLength(3);
    expect(events[0].detail).toEqual({
      chapterId: 'ch-1',
      paragraphIndex: 3,
      quote: 'Цитата',
      blockId: 'blk-1'
    });
    document.removeEventListener('ww:locate-promise', listener);

    vm.handleUpdatePlanetName('tab-1', 'Марс');
    vm.handleUpdateCalendarName('tab-2', 'Лунный');
    expect(mockShell.updateTabTitle).toHaveBeenNthCalledWith(1, 'tab-1', 'Марс');
    expect(mockShell.updateTabTitle).toHaveBeenNthCalledWith(2, 'tab-2', 'Лунный');

    vm.handleUpdatePlanet('tab-1', { id: 'pl-1', name: 'Марс' });
    expect(mockShell.handleUpdateData).toHaveBeenCalledWith('tab-1', { id: 'pl-1', name: 'Марс' });

    vm.onGroupCloseTab({}, 'tab-9');
    expect(mockShell.closeEditor).toHaveBeenCalledWith('tab-9');

    vm.setActivePanelTab('console');
    expect(mockShell.activePanelTab).toBe('console');
    vm.togglePanel();
    expect(mockShell.activePanelTab).toBe('');
    vm.togglePanel();
    expect(mockShell.activePanelTab).toBe('console');

    vm.toggleSidebar();
    expect(mockShell.sidebarVisible).toBe(false);

    // __FEATURE_AI__ is false in unit test mode -> toggleWowilon is no-op
    vm.toggleWowilon();
    expect(mockShell.isWowilonOpen).toBe(false);

    // Evaluate all template-exposed computed getters for full coverage
    const computedKeys = [
      'projectName', 'activeView', 'currentSidebarTab', 'showSettings',
      'sidebarSearch', 'activePanelTab', 'openEditors', 'activeEditorId',
      'activeEditor', 'activeEntityRawId', 'consoleLogs', 'activeField',
      'panelHeight', 'sidebarWidth', 'sidebarItems', 'activeSidebarItem',
      'filteredEntityList', 'chapters', 'sidebarVisible', 'zoomLevel',
      'unsavedCount', 'settings', 'toasts', 'activeTreeNode',
      'editorGroups', 'activeGroupId', 'isWowilonOpen',
      'isCreateChapterModalOpen', 'createChapterTargetVolumeId',
      'isCreateEntityModalOpen', 'createEntityTargetType'
    ];
    for (const key of computedKeys) {
      expect((wrapper.vm as unknown as Record<string, unknown>)[key]).toBeDefined();
    }

    wrapper.unmount();
  });
});

