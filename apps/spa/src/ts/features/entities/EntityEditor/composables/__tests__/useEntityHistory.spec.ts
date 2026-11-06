import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useEntityHistory } from '../useEntityHistory';
import * as api from '@/services/api.client';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/services/api.client', () => ({
  toggleEntityHistoryPin: vi.fn(),
}));

describe('useEntityHistory', () => {
  let props: any;
  let emit: any;
  let formData: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = { project: 'p1', entityId: 'c1' };
    emit = vi.fn();
    formData = ref({ name: 'Arthur', age: 30, profile: { title: 'King' } });
  });

  it('toggles pin state with error handling', async () => {
    vi.mocked(api.toggleEntityHistoryPin).mockResolvedValueOnce(undefined as any);

    const history = useEntityHistory(props, emit, formData);
    const rev: any = { id: 'rev_1', is_pinned: false };

    await history.togglePin(rev);
    expect(api.toggleEntityHistoryPin).toHaveBeenCalledWith('rev_1', true);
    expect(rev.is_pinned).toBe(true);

    // Error handling
    vi.mocked(api.toggleEntityHistoryPin).mockRejectedValueOnce(new Error('Network fail'));
    await history.togglePin(rev);
  });

  it('loads history, formats dates, and handles errors and missing props', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { id: 'rev_1', created_at: '2024-01-01T12:00:00Z', is_pinned: false },
    ]);

    const history = useEntityHistory(props, emit, formData);
    await history.loadHistory();

    expect(history.revisions.value.length).toBe(1);
    expect(history.revisions.value[0].formattedDate).toBeDefined();

    // Error branch
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Invoke fail'));
    await history.loadHistory();

    // Missing project or entityId
    const emptyHistory = useEntityHistory({ project: '', entityId: '' }, emit, formData);
    await emptyHistory.loadHistory();
    expect(emptyHistory.revisions.value).toEqual([]);
  });

  it('toggles history panel visibility', () => {
    const history = useEntityHistory(props, emit, formData);
    expect(history.showHistory.value).toBe(false);

    history.toggleHistory();
    expect(history.showHistory.value).toBe(true);
  });

  it('previews and restores history revision', async () => {
    const history = useEntityHistory(props, emit, formData);
    const rev: any = { id: 'rev_1', content: { name: 'Arthur Old' } };
    history.revisions.value = [rev];

    history.previewHistory(rev);
    expect(history.isPreviewingHistory.value).toBe(true);
    expect(history.previewingRevId.value).toBe('rev_1');
    expect(formData.value.name).toBe('Arthur Old');

    history.exitHistoryPreview();
    expect(history.isPreviewingHistory.value).toBe(false);
    expect(history.previewingRevId.value).toBeNull();
    expect(formData.value.name).toBe('Arthur');

    // Restore
    history.previewHistory(rev);
    await history.restoreHistory();
    expect(history.isPreviewingHistory.value).toBe(false);
    expect(formData.value.name).toBe('Arthur Old');
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('calculates diff summary for addition, change, deletion, no-change, and missing previous', () => {
    const history = useEntityHistory(props, emit, formData);
    const prev: any = { id: 'rev_0', content: { name: 'Arthur', deletedField: 123 } };
    const rev: any = { id: 'rev_1', content: { name: 'Arthur Modified', newField: 'value' } };

    const diff = history.getDiffSummary(rev, prev);
    expect(diff).toContain('+ newField');
    expect(diff).toContain('~ name');
    expect(diff).toContain('- deletedField');

    // Identical
    expect(history.getDiffSummary(prev, prev)).toBe('Без изменений');

    // Missing previous
    expect(history.getDiffSummary(rev, undefined)).toBe('');
  });

  it('checks if fields are changed during preview with isFieldChanged', () => {
    const history = useEntityHistory(props, emit, formData);
    expect(history.isFieldChanged('name')).toBe(false);

    const rev: any = { id: 'rev_1', content: { name: 'Arthur Old', age: 30 } };
    history.revisions.value = [rev];
    history.previewHistory(rev);

    expect(history.isFieldChanged('name')).toBe(true);
    expect(history.isFieldChanged('age')).toBe(false);
    expect(history.isFieldChanged('profile.title')).toBe(true);
  });

  it('loads history on toggle if list is empty', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { id: 'rev_2', created_at: '2024-01-02T12:00:00Z', is_pinned: false },
    ]);

    const history = useEntityHistory(props, emit, formData);
    await history.toggleHistory();

    expect(history.showHistory.value).toBe(true);
    expect(invoke).toHaveBeenCalledWith('get_entity_revisions', {
      project: 'p1',
      entityId: 'c1',
    });
  });
});
