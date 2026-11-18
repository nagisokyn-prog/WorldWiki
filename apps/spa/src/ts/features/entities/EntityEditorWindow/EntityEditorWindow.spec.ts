import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEntityEditorWindow } from './useEntityEditorWindow';

vi.mock('@/services/api.client', () => ({
  saveEntityWithRelations: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: vi.fn().mockResolvedValue({ id: 'entities:char1', name: 'Hero' }),
    formatEntityPayload: vi.fn().mockReturnValue({ id: 'entities:char1', name: 'Hero' }),
  },
}));

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe('useEntityEditorWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const hook = useEntityEditorWindow({
      project: 'test_proj',
      entityType: 'character',
      entityId: 'char1',
    });

    expect(hook.isLoadingData.value).toBe(true);
    expect(hook.isUnsaved.value).toBe(false);
    expect(hook.showHistory.value).toBe(false);
    expect(hook.isPreviewingHistory.value).toBe(false);
  });

  it('loads entity data on loadData call', async () => {
    const hook = useEntityEditorWindow({
      project: 'test_proj',
      entityType: 'character',
      entityId: 'char1',
    });

    await hook.loadData();
    expect(hook.isLoadingData.value).toBe(false);
    expect(hook.initialData.value.name).toBe('Hero');
  });

  it('manages history preview state correctly', () => {
    const hook = useEntityEditorWindow({
      project: 'test_proj',
      entityType: 'character',
      entityId: 'char1',
    });

    hook.previewHistory({
      id: 'rev1',
      target_id: 'char1',
      content: { name: 'Old Hero' },
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(hook.isPreviewingHistory.value).toBe(true);
    expect(hook.previewingRevId.value).toBe('rev1');
    expect(hook.previewData.value).toEqual({ name: 'Old Hero' });

    hook.exitHistoryPreview();
    expect(hook.isPreviewingHistory.value).toBe(false);
    expect(hook.previewingRevId.value).toBeNull();
  });

  it('restores history and marks as unsaved', () => {
    const hook = useEntityEditorWindow({
      project: 'test_proj',
      entityType: 'character',
      entityId: 'char1',
    });

    hook.previewHistory({
      id: 'rev1',
      target_id: 'char1',
      content: { name: 'Restored Hero' },
      created_at: '2026-01-01T00:00:00Z',
    });

    hook.restoreHistory();
    expect(hook.isPreviewingHistory.value).toBe(false);
    expect(hook.isUnsaved.value).toBe(true);
    expect(hook.initialData.value).toEqual({ name: 'Restored Hero' });
  });

  it('toggles history panel', () => {
    const hook = useEntityEditorWindow({
      project: 'test_proj',
      entityType: 'character',
      entityId: 'char1',
    });

    expect(hook.showHistory.value).toBe(false);
    hook.toggleHistory();
    expect(hook.showHistory.value).toBe(true);
    hook.toggleHistory();
    expect(hook.showHistory.value).toBe(false);
  });

  it('covers saveEntity, handleUpdateData live sync, Tauri listeners on mount, and cleanup on unmount', async () => {
    const { defineComponent } = await import('vue');
    const { mount, flushPromises } = await import('@vue/test-utils');
    const api = await import('@/services/api.client');
    const { appAlert } = await import('@worldwiki/components');

    let hook!: ReturnType<typeof useEntityEditorWindow>;
    const Comp = defineComponent({
      setup() {
        hook = useEntityEditorWindow({
          project: 'test_proj',
          entityType: 'character',
          entityId: 'char1',
        });
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    // handleUpdateData debounced live sync
    vi.useFakeTimers();
    hook.handleUpdateData({ name: 'Live Hero' });
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await flushPromises();

    // saveEntity success
    hook.editorRef.value = {
      getFormData: () => ({ name: 'Saved Hero' }),
      getForeignUpdates: () => ({}),
    } as never;
    await hook.save();
    expect(api.saveEntityWithRelations).toHaveBeenCalled();
    expect(hook.isUnsaved.value).toBe(false);

    // save error
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.saveEntityWithRelations).mockRejectedValueOnce(new Error('save fail'));
    await hook.save();
    expect(appAlert).toHaveBeenCalledWith('Ошибка сохранения сущности');
    errSpy.mockRestore();

    wrapper.unmount();
    vi.useRealTimers();
  });

  it('triggers Tauri ww-entity-saved and ww-entity-live-sync listeners', async () => {
    const { defineComponent } = await import('vue');
    const { mount, flushPromises } = await import('@vue/test-utils');
    const { listen } = await import('@tauri-apps/api/event');
    const { entityApi } = await import('@/services/Entity/entity.api');

    const handlers: Record<string, (e: { payload: Record<string, unknown> }) => void> = {};
    vi.mocked(listen).mockImplementation(async (ev, cb) => {
      handlers[ev] = cb as typeof handlers[string];
      return () => {};
    });

    let hook!: ReturnType<typeof useEntityEditorWindow>;
    const Comp = defineComponent({
      setup() {
        hook = useEntityEditorWindow({
          project: 'test_proj',
          entityType: 'character',
          entityId: 'char1',
        });
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    handlers['ww-entity-saved']?.({ payload: { type: 'character', id: 'entities:char1' } });
    await flushPromises();
    expect(entityApi.getEntity).toHaveBeenCalledTimes(2);

    handlers['ww-entity-live-sync']?.({
      payload: { type: 'character', id: 'char1', data: { name: 'Synced Hero' }, sender: 'other-window' },
    });
    expect(hook.initialData.value.name).toBe('Synced Hero');

    // Empty entityId/project guards + previewData fallback
    const emptyHook = useEntityEditorWindow({ project: '', entityType: '', entityId: '' });
    await emptyHook.loadData();
    await emptyHook.save();
    await emptyHook.loadHistory();
    emptyHook.previewHistory({ snapshot: undefined } as any);
    emptyHook.exitHistoryPreview();
    expect(emptyHook.initialData.value).toEqual({});

    wrapper.unmount();
  });
});

