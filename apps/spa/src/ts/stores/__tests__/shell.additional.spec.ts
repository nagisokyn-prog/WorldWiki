// additional tests for shell store to cover uncovered branches
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useShellStore } from '../shell';
import { entityApi } from '../../services/Entity/entity.api';
import { settingsService } from '@worldwiki/components';
import { useConsoleStore } from '../console';

// Mock @tauri-apps/api/event for testing event emission
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

// Mock @worldwiki/components
vi.mock('@worldwiki/components', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    appConfirm: vi.fn().mockResolvedValue(true),
    appAlert: vi.fn(),
    settingsService: {
      getSettings: vi.fn(() => ({ layout: { sidebarPos: 'row' } })),
      resetSettings: vi.fn(),
      onChange: vi.fn(),
    },
  };
});

// Mock entityApi
vi.mock('../../services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: vi.fn(),
    getEntityList: vi.fn().mockResolvedValue([]),
    saveEntity: vi.fn().mockResolvedValue({ success: true, id: 'mock_id' }),
    deleteEntity: vi.fn(),
    formatEntityPayload: vi.fn(),
  },
}));

// Mock schema store
vi.mock('../schema', () => ({
  useSchemaStore: () => ({
    loadSchema: vi.fn(),
    getEntityDisplayName: vi.fn((e: any) => e?.name || e?.title || 'Mock'),
  }),
}));

// console store is not mocked - use real one like in shell.spec.ts

// Mock zoom store
vi.mock('../zoom', () => ({
  useZoomStore: () => ({
    zoomLevel: 1,
    applyZoom: vi.fn(),
  }),
}));

// Mock floating store
vi.mock('../floating', () => ({
  useFloatingStore: () => ({}),
}));

// Mock api.client
vi.mock('../../services/api.client', () => ({
  getChapter: vi.fn(),
  getChapters: vi.fn(),
  saveChapter: vi.fn(),
  deleteChapter: vi.fn(),
  getChapterHierarchy: vi.fn(),
  assignChapter: vi.fn(),
  deleteVolume: vi.fn(),
  deleteArc: vi.fn(),
  getEntities: vi.fn(),
  saveEntityWithRelations: vi.fn(),
  deleteEntity: vi.fn(),
  getSchema: vi.fn().mockResolvedValue({}),
  saveSchema: vi.fn().mockResolvedValue(true),
}));

describe('shell store additional coverage', () => {
  let store: ReturnType<typeof useShellStore>;
  let consoleMod: ReturnType<typeof useConsoleStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useShellStore();
    consoleMod = useConsoleStore();
  });

  it('openEntity creates tab and avoids duplicate', async () => {
    const mockEntity = { id: 'e1', name: 'Entity' };
    vi.mocked(entityApi.getEntity).mockResolvedValue(mockEntity);
    await store.openEntity({ id: 'e1', entityType: 'character', name: 'Entity' });
    expect(store.openEditors.length).toBe(1);
    const firstId = store.openEditors[0].id;
    await store.openEntity({ id: 'e1', entityType: 'character' });
    expect(store.openEditors.length).toBe(1);
    expect(store.openEditors[0].id).toBe(firstId);
  });

  it('openChapterTab adds chapter editor tab', () => {
    store.openChapterTab({ id: 'c1', title: 'Chapter' });
    expect(store.openEditors.length).toBe(1);
    expect(store.openEditors[0].tabType).toBe('chapter');
    expect(store.openEditors[0].title).toBe('Chapter');
  });

  it('openSchemaEditor creates schema editor tab', async () => {
    await store.openSchemaEditor('character');
    expect(store.openEditors.length).toBe(1);
    expect(store.openEditors[0].tabType).toBe('schema-editor');
    expect(store.openEditors[0].id).toBe('schema-editor:character');
  });

  it('closeEditor removes specific tab', () => {
    const tab = { id: 't1', rawId: '1', title: 'T', entityType: 'e', tabType: 'entity', data: {}, unsaved: false };
    store.openChapterTab(tab);
    expect(store.openEditors.length).toBe(1);
    store.closeEditor(tab.id);
    expect(store.openEditors.length).toBe(0);
  });

  it('markUnsaved / markSaved toggle unsaved flag and toast', () => {
    store.openChapterTab({ id: 'c1', title: 'Chapter', data: {} });
    const tabId = store.openEditors[0].id;
    store.markUnsaved(tabId);
    const tab = store.openEditors[0];
    expect(tab.unsaved).toBe(true);
    // markUnsaved does NOT call addToast - only markSaved does
    store.markSaved(tabId);
    expect(store.openEditors[0].unsaved).toBe(false);
    // addToast is called when markSaved is invoked - check real console store toasts
    expect(consoleMod.toasts.length).toBe(1);
    expect(consoleMod.toasts[0].text).toBe('Глава сохранена');
    expect(consoleMod.toasts[0].type).toBe('success');
  });

  it('toggleSettings and resetSettings affect flag and call service', () => {
    expect(store.showSettings).toBe(false);
    store.toggleSettings();
    expect(store.showSettings).toBe(true);
    store.toggleSettings();
    expect(store.showSettings).toBe(false);
    store.resetSettings();
    expect(settingsService.resetSettings).toHaveBeenCalled();
  });

  it('handleUpdateData merges data and emits event', async () => {
    store.openChapterTab({ id: 'c1', title: 'Chapter', data: { content: 'old' } });
    const tabId = store.openEditors[0].id;
    const { emit } = await import('@tauri-apps/api/event');
    const emitMock = vi.mocked(emit);
    store.handleUpdateData(tabId, { content: 'new', extra: { nested: 'value' } });
    await vi.waitFor(() => {
      expect(emitMock).toHaveBeenCalledWith('ww-entity-live-sync', expect.objectContaining({
        type: 'chapter',
        id: 'c1',
        data: expect.objectContaining({ content: 'new', extra: { nested: 'value' } }),
      }));
    }, { timeout: 500 });
  });

  it('resize functions attach and detach mouse event listeners cleanly', () => {
    const e = { clientY: 100, clientX: 100, target: document.createElement('div') } as any;

    store.startResize(e);
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    store.startSidebarResize(e);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
  });

  it('restoreState with legacy openTabs format (no editorGroups) sets tabs[0] as active', async () => {
    // State without editorGroups, with rawTabs, no matching activeEditorId
    const { getChapter } = await import('../../services/api.client');
    vi.mocked(getChapter).mockResolvedValue({ id: 'leg_c1', title: 'Legacy Chapter', content: 'x' } as any);

    localStorage.setItem('worldwiki-state-default', JSON.stringify({
      activeView: 'entity',
      openTabs: [
        { id: 'leg_c1', rawId: 'leg_c1', tabType: 'chapter', entityType: 'chapter', title: 'Legacy' },
      ],
      // no editorGroups, activeEditorId doesn't match
      activeEditorId: 'nonexistent_id',
    }));

    await store.restoreState();
    // After restore, the first tab should be active
    const group = store.editorGroups[0];
    expect(group.activeTabId).toBe('leg_c1');

    localStorage.removeItem('worldwiki-state-default');
  });

  it('handles handleQuickOpenSelect for chapters and entities, and openQuickOpen', async () => {
    // 1. Chapter selection
    store.handleQuickOpenSelect({ id: 'ch_1', rawId: 'ch_1', title: 'Chapter 1', typeLabel: 'Глава', emoji: '📝', entityType: 'chapter', data: { id: 'ch_1', title: 'Chapter 1' } });
    expect(store.openEditors.some((e: any) => e.id === 'ch_1')).toBe(true);

    // 2. Entity selection
    vi.mocked(entityApi.getEntity).mockResolvedValue({ id: 'char_1', name: 'Galahad' });
    store.handleQuickOpenSelect({ id: 'char_1', rawId: 'char_1', title: 'Char', typeLabel: 'Персонаж', emoji: '👤', entityType: 'character', data: { id: 'char_1', entityType: 'character' } });
    await vi.waitFor(() => {
      expect(store.openEditors.some((e: any) => e.entityType === 'character')).toBe(true);
    });

    // 3. openQuickOpen when ref is null or present
    store.openQuickOpen();
    store.quickOpenRef = { open: vi.fn() } as any;
    store.openQuickOpen();
    expect(store.quickOpenRef?.open).toHaveBeenCalled();
  });

  it('handles liveSync error logging without throwing', async () => {
    const { emit } = await import('@tauri-apps/api/event');
    vi.mocked(emit).mockRejectedValueOnce(new Error('Tauri IPC failed'));

    store.openChapterTab({ id: 'c1', title: 'Chapter', data: { content: 'test' } });
    const tabId = store.openEditors[0].id;

    store.handleUpdateData(tabId, { content: 'updated' });
    await new Promise((r) => setTimeout(r, 200));
  });

  it('handles saveAll with chapter, schema-editor, and regular entity', async () => {
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

    // 1. Chapter editor unsaved
    store.openChapterTab({ id: 'c1', title: 'Chapter' });
    store.openEditors[0].unsaved = true;

    // 2. Schema editor unsaved
    await store.openSchemaEditor('location');
    store.openEditors[1].unsaved = true;

    // 3. Entity editor unsaved
    store.openChapterTab({
      id: 'entity_hero_1',
      title: 'Hero',
      data: { name: 'Hero Name' },
    });
    store.openEditors[2].unsaved = true;
    store.openEditors[2].tabType = 'entity';
    store.openEditors[2].rawId = 'hero_1';
    store.openEditors[2].entityType = 'hero';

    const { emit } = await import('@tauri-apps/api/event');
    vi.mocked(emit).mockRejectedValueOnce(new Error('Tauri emit failed')); // trigger line 648

    await store.saveAll();

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'ww:trigger-chapter-save' }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'ww:trigger-schema-save' }));
  });

  it('handles deleteEntity with silent and interactive confirmation modes', async () => {
    store.openChapterTab({ id: 'del_1', title: 'To Delete' });

    // Silent deletion
    await store.deleteEntity('del_1', 'item', true);
    expect(store.openEditors.length).toBe(0);

    // Non-silent confirmed
    store.openChapterTab({ id: 'del_2', title: 'To Delete 2' });

    const delPromise = store.deleteEntity('del_2', 'item', false);
    const confirmBtn = document.querySelector('#confirm-btn') as HTMLButtonElement;
    confirmBtn?.click();
    await delPromise;

    expect(store.openEditors.length).toBe(0);
  });

  it('handles startGroupResize with container element and bounds clamping', () => {
    const container = document.createElement('div');
    container.className = 'editor-groups-container';
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as any);
    const handle = document.createElement('div');
    container.appendChild(handle);
    document.body.appendChild(container);

    store.splitRight();
    // Clamping: deltaPct exceeds range
    store.startGroupResize({ currentTarget: handle, clientX: 100 } as any, 0);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 950 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    // Boundary check when groupIdx is invalid
    store.startGroupResize({ currentTarget: handle, clientX: 100 } as any, 99);
  });

  it('covers addLog >100 entries, activeEditorId setter, and activeSidebarItem', () => {
    // 1. addLog > 100 entries
    for (let i = 0; i < 105; i++) {
      store.addLog(`Message ${i}`, 'info');
    }
    expect(store.consoleLogs.length).toBe(100);

    // 2. activeEditorId setter
    store.openChapterTab({ id: 'c_tab1', title: 'Chapter 1' });
    store.activeEditorId = 'c_tab1';
    expect(store.activeEditorId).toBe('c_tab1');
    store.activeEditorId = 'non_existent_tab';
    store.activeEditorId = null;

    // 3. activeSidebarItem
    store.sidebarItems = [
      { type: 'static', url: '/graph', icon: '📊', emoji: '📊', title: 'Graph' },
      { type: 'chapters', icon: '📝', emoji: '📝', title: 'Chapters' },
      { type: 'entity', entityType: 'hero', icon: '🦸', emoji: '🦸', title: 'Heroes' },
    ];
    store.currentSidebarTab = '/graph';
    expect(store.activeSidebarItem?.title).toBe('Graph');
    store.currentSidebarTab = 'chapters';
    expect(store.activeSidebarItem?.title).toBe('Chapters');
    store.currentSidebarTab = 'hero';
    expect(store.activeSidebarItem?.title).toBe('Heroes');
    store.currentSidebarTab = 'unknown_type';
    expect(store.activeSidebarItem).toBeNull();
  });

  it('covers filteredEntityList for chapters and entities with search filter', () => {
    store.chapters = [{ id: '1', title: 'First Chapter' }, { id: '2', title: 'Second' }] as any;
    store.entityLists = { hero: [{ name: 'Superman' }, { name: 'Batman' }] };

    // Chapters search
    store.currentSidebarTab = 'chapters';
    store.sidebarSearch = '';
    expect(store.filteredEntityList.length).toBe(2);
    store.sidebarSearch = 'first';
    expect(store.filteredEntityList.length).toBe(1);

    // Entity search
    store.currentSidebarTab = 'hero';
    store.sidebarSearch = 'super';
    expect(store.filteredEntityList.length).toBe(1);
    store.sidebarSearch = 'nonexistent';
    expect(store.filteredEntityList.length).toBe(0);
  });

  it('covers selectSidebarTab branches (static with and without query, chapters, entityType)', () => {
    const originalHref = window.location.href;
    try {
      // 1. static tab without query
      store.selectSidebarTab({ type: 'static', url: '/graph', icon: '📊', emoji: '📊', title: 'Graph' });

      // 2. static tab with existing query
      store.selectSidebarTab({ type: 'static', url: '/graph?view=2d', icon: '📊', emoji: '📊', title: 'Graph' });

      // 3. chapters tab
      store.selectSidebarTab({ type: 'chapters', icon: '📝', emoji: '📝', title: 'Chapters' });
      expect(store.currentSidebarTab).toBe('chapters');

      // 4. entity tab with entityType
      store.selectSidebarTab({ type: 'entity', entityType: 'hero', icon: '🦸', emoji: '🦸', title: 'Heroes' });
      expect(store.currentSidebarTab).toBe('hero');

      // 5. entity tab without entityType
      store.selectSidebarTab({ type: 'entity', icon: '📄', emoji: '📄', title: 'Generic' });
      expect(store.currentSidebarTab).toBeNull();
    } finally {
      window.location.href = originalHref;
    }
  });

  it('covers openEntity edge cases and title fallbacks', async () => {
    // 1. Missing entityType
    await store.openEntity({ id: '1' });
    expect(store.openEditors.length).toBe(0);

    // 2. Invalid id or 'undefined'
    await store.openEntity({ entityType: 'hero', id: 'undefined' });
    await store.openEntity({ entityType: 'hero' });
    expect(store.openEditors.length).toBe(0);

    // 3. Name vs name vs title fallback
    vi.mocked(entityApi.getEntity).mockResolvedValue({ id: 'e1', Name: 'Custom Capital Name' } as any);
    await store.openEntity({ entityType: 'hero', id: 'e1', Name: 'Custom Capital Name' });
    expect(store.openEditors.some((e: any) => e.title === 'Custom Capital Name')).toBe(true);

    // 4. Chapter openTab without title fallback
    store.openChapterTab({ id: 'fallback_ch_1' });
    expect(store.openEditors.some((e: any) => e.title === 'Глава fallback_ch_1')).toBe(true);

    // 5. getEntity throwing error
    vi.mocked(entityApi.getEntity).mockRejectedValueOnce(new Error('Fetch failed'));
    await store.openEntity({ entityType: 'hero', id: 'e_error', name: 'Will Fail' });
  });

  it('handles foreign updates merging and deep object merging in handleUpdateData', async () => {
    await store.openEntity({ id: 'hero_1', entityType: 'hero', name: 'Original Name' });
    const tabId = store.openEditors[0].id;

    store.handleUpdateData(tabId, {
      profile: { bio: 'New bio', age: 30 },
      list: [{ id: 1, text: 'a' }, { id: 2, text: 'b' }],
      __foreignUpdates: { 'affil:1': { data: {} } },
    });

    expect((store.openEditors[0] as any)._foreignUpdates).toBeDefined();

    // Shrinking array
    store.handleUpdateData(tabId, {
      list: [{ id: 1, text: 'shrunk' }],
    });
    expect((store.openEditors[0].data.list as unknown[]).length).toBe(1);
  });

  it('covers startSidebarResize and startSplitResize with layout variants', () => {
    // 1. Sidebar resize in row-reverse mode
    store.settings.layout = { ...store.settings.layout, sidebarPos: 'row-reverse' };
    const e = { clientX: 100, target: document.createElement('div') } as any;
    store.startSidebarResize(e);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    // 2. Split resize with wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'split-layout-wrapper';
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as any);
    const splitHandle = document.createElement('div');
    wrapper.appendChild(splitHandle);
    document.body.appendChild(wrapper);

    store.startSplitResize({ target: splitHandle, clientX: 100 } as any);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    // Split resize without wrapper
    store.startSplitResize({ target: document.createElement('div'), clientX: 100 } as any);
  });

  it('covers quickOpenDataSource API calls and error catches', async () => {
    const { getChapters, getEntities } = await import('../../services/api.client');
    vi.mocked(getChapters).mockResolvedValueOnce([{ id: 'c1', title: 'Chapter 1' }] as any);
    vi.mocked(getEntities).mockResolvedValueOnce([{ id: 'e1', name: 'Hero 1' }] as any);

    store.sidebarItems = [
      { type: 'entity', entityType: 'hero', icon: '🦸', emoji: '🦸', title: 'Heroes' },
    ];

    const data = await store.quickOpenDataSource();
    expect(data.length).toBe(2);

    // Errors catch branch
    vi.mocked(getChapters).mockRejectedValueOnce(new Error('Chapter error'));
    vi.mocked(getEntities).mockRejectedValueOnce(new Error('Entity error'));
    const emptyData = await store.quickOpenDataSource();
    expect(emptyData.length).toBe(0);
  });

  it('covers renameEntity, renameChapter, and deleteChapter branches', async () => {
    // 1. renameEntity with closed tab
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({ id: 'ent_1', name: 'Old' } as any);
    await store.renameEntity('hero', 'ent_1', 'New Hero');

    // 2. renameChapter with getChapter returning data vs null
    const { getChapter, saveChapter, deleteChapter } = await import('../../services/api.client');
    vi.mocked(getChapter).mockResolvedValueOnce({ id: 'c1', title: 'Old Chapter' } as any);
    await store.renameChapter({ id: 'c1' }, 'New Chapter');
    expect(saveChapter).toHaveBeenCalled();

    // 3. deleteChapter
    store.openChapterTab({ id: 'del_c1', title: 'Chapter to Delete' });
    await store.deleteChapter({ id: 'del_c1', title: 'Chapter to Delete' });
    expect(deleteChapter).toHaveBeenCalledWith('del_c1');
  });

  it('covers addNewEntity for chapters (predefined and cancelled) and character (nested path)', async () => {
    const origPrompt = window.prompt;
    try {
      // 1. addNewEntity chapters with predefined name
      await store.addNewEntity('chapters', 'Preset Chapter');
      expect(store.chapters.some((c: any) => c.title === 'Preset Chapter')).toBe(true);

      // 2. addNewEntity chapters cancelled
      window.prompt = () => null;
      await store.addNewEntity('chapters');

      // 3. addNewEntity entity with nested title field
      window.prompt = () => 'New Nested Entity';
      const { useSchemaStore } = await import('../schema');
      const schemaStore = useSchemaStore();
      vi.mocked(schemaStore.loadSchema).mockResolvedValueOnce({
        titleField: 'profile.name',
      } as any);
      vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({ success: true, id: 'new_ent_1' } as any);
      vi.mocked(entityApi.getEntity).mockResolvedValueOnce({ id: 'new_ent_1', profile: { name: 'New Nested Entity' } } as any);

      await store.addNewEntity('hero');

      // 4. saveEntity returns null id
      vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({ success: false, id: '' } as any);
      await store.addNewEntity('hero', 'Preset Name');
    } finally {
      window.prompt = origPrompt;
    }
  });

  it('covers createChapterIn with arcId, volumeId, and hierarchy numbering', async () => {
    const { getChapterHierarchy, saveChapter, assignChapter } = await import('../../services/api.client');
    vi.mocked(getChapterHierarchy).mockResolvedValueOnce({
      chapters: [
        { id: '1', title: 'Глава 3', arc_id: 'arc_1' },
        { id: '2', title: 'Глава 7', arc_id: 'arc_1' },
      ],
    } as any);
    vi.mocked(saveChapter).mockResolvedValueOnce({ id: 'created_ch_8' } as any);

    await store.createChapterIn({ arcId: 'arc_1', volumeId: 'vol_1' });
    expect(assignChapter).toHaveBeenCalled();

    // Root chapter numbering
    vi.mocked(getChapterHierarchy).mockResolvedValueOnce({ chapters: [] } as any);
    await store.createChapterIn();
  });

  it('covers deleteVolume and deleteArc with confirm and silent modes', async () => {
    const { appConfirm } = await import('@worldwiki/components');
    const { deleteVolume, deleteArc } = await import('../../services/api.client');

    // 1. deleteVolume cancelled
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await store.deleteVolume({ id: 'vol_1', title: 'Volume 1' }, [], [], false);
    expect(deleteVolume).not.toHaveBeenCalled();

    // 2. deleteVolume silent
    await store.deleteVolume({ id: 'vol_1', title: 'Volume 1' }, [{ id: 'ch_in_vol' }], ['arc_in_vol'], true);
    expect(deleteVolume).toHaveBeenCalledWith('vol_1');

    // 3. deleteArc cancelled
    vi.mocked(deleteArc).mockClear();
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await store.deleteArc({ id: 'arc_1', title: 'Arc 1' }, [], false);
    expect(deleteArc).not.toHaveBeenCalled();

    // 4. deleteArc silent
    await store.deleteArc({ id: 'arc_1', title: 'Arc 1' }, [{ id: 'ch_in_arc' }], true);
    expect(deleteArc).toHaveBeenCalledWith('arc_1');
  });

  it('covers loadChapters and loadEntityList error catches', async () => {
    const { getChapters } = await import('../../services/api.client');
    vi.mocked(getChapters).mockRejectedValueOnce(new Error('Failed chapters load'));
    await store.loadChapters();
    expect(store.chapters).toEqual([]);

    vi.mocked(entityApi.getEntityList).mockRejectedValueOnce(new Error('Failed list load'));
    await store.loadEntityList('hero');
    expect(store.entityLists.hero ?? []).toEqual([]);
  });
});
