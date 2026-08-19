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
    deleteEntity: vi.fn(),
  },
}));

// Mock schema store
vi.mock('../schema', () => ({
  useSchemaStore: () => ({
    loadSchema: vi.fn(),
    getEntityDisplayName: vi.fn(() => 'Mock'),
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

  it('handles handleQuickOpenSelect for chapters and entities, and openQuickOpen', async () => {
    // 1. Chapter selection
    store.handleQuickOpenSelect({ entityType: 'chapter', data: { id: 'ch_1', title: 'Chapter 1' } });
    expect(store.openEditors.some((e: any) => e.id === 'chapter_ch_1')).toBe(true);

    // 2. Entity selection
    vi.mocked(entityApi.getEntity).mockResolvedValue({ id: 'char_1', name: 'Galahad' });
    store.handleQuickOpenSelect({ entityType: 'character', data: { id: 'char_1', entityType: 'character' } });
    await vi.waitFor(() => {
      expect(store.openEditors.some((e: any) => e.entityType === 'character')).toBe(true);
    });

    // 3. openQuickOpen when ref is null or present
    store.openQuickOpen();
    store.quickOpenRef = { open: vi.fn() } as any;
    store.openQuickOpen();
    expect(store.quickOpenRef.open).toHaveBeenCalled();
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
    store.openEditors.push({
      id: 'entity_hero_1',
      rawId: 'hero_1',
      title: 'Hero',
      entityType: 'hero',
      tabType: 'entity',
      data: { name: 'Hero Name' },
      unsaved: true,
    } as any);

    const { emit } = await import('@tauri-apps/api/event');
    vi.mocked(emit).mockRejectedValueOnce(new Error('Tauri emit failed')); // trigger line 648

    await store.saveAll();

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'ww:trigger-chapter-save' }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'ww:trigger-schema-save' }));
  });

  it('handles deleteEntity with silent and interactive confirmation modes', async () => {
    store.openEditors.push({
      id: 'entity_delete_1',
      rawId: 'del_1',
      title: 'To Delete',
      entityType: 'item',
      tabType: 'entity',
      data: {},
      unsaved: false,
    } as any);

    // Silent deletion
    await store.deleteEntity('entity_delete_1', 'item', true);
    expect(store.openEditors.length).toBe(0);

    // Non-silent confirmed
    store.openEditors.push({
      id: 'entity_delete_2',
      rawId: 'del_2',
      title: 'To Delete 2',
      entityType: 'item',
      tabType: 'entity',
      data: {},
      unsaved: false,
    } as any);

    await store.deleteEntity('entity_delete_2', 'item', false);
    expect(store.openEditors.length).toBe(0);
  });

  it('handles startGroupResize with container element', () => {
    const container = document.createElement('div');
    container.className = 'editor-groups-container';
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as any);
    const handle = document.createElement('div');
    container.appendChild(handle);
    document.body.appendChild(container);

    store.splitRight();
    store.startGroupResize({ currentTarget: handle, clientX: 100 } as any, 0);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
  });
});
