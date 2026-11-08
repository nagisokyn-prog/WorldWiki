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
});

