import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useEntityHistory } from '../useEntityHistory';
import * as api from '../../../../../services/api.client';

vi.mock('../../../../../services/api.client', () => ({
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
    formData = ref({ name: 'Arthur', age: 30 });
    (window as any).__TAURI__ = {
      core: {
        invoke: vi.fn(),
      },
    };
  });

  it('toggles pin state', async () => {
    vi.mocked(api.toggleEntityHistoryPin).mockResolvedValueOnce(undefined as any);

    const history = useEntityHistory(props, emit, formData);
    const rev = { id: 'rev_1', is_pinned: false };

    await history.togglePin(rev);

    expect(api.toggleEntityHistoryPin).toHaveBeenCalledWith('rev_1', true);
    expect(rev.is_pinned).toBe(true);
  });

  it('loads history and formats dates', async () => {
    vi.mocked((window as any).__TAURI__.core.invoke).mockResolvedValueOnce([
      { id: 'rev_1', created_at: '2024-01-01T12:00:00Z', is_pinned: false },
    ]);

    const history = useEntityHistory(props, emit, formData);
    await history.loadHistory();

    expect(history.revisions.value.length).toBe(1);
    expect(history.revisions.value[0].formattedDate).toBeDefined();
  });

  it('toggles history panel visibility', () => {
    const history = useEntityHistory(props, emit, formData);
    expect(history.showHistory.value).toBe(false);

    history.toggleHistory();
    expect(history.showHistory.value).toBe(true);
  });

  it('previews and restores history revision', () => {
    const history = useEntityHistory(props, emit, formData);
    const rev = {
      id: 'rev_1',
      content: {
        data: { name: 'Arthur (Old)', age: 25 },
      },
    };
    history.revisions.value = [rev];

    history.previewHistory(rev);
    expect(history.isPreviewingHistory.value).toBe(true);
    expect(formData.value.name).toBe('Arthur (Old)');

    history.restoreHistory();
    expect(history.isPreviewingHistory.value).toBe(false);
    expect(formData.value.name).toBe('Arthur (Old)');
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('exits history preview without saving', () => {
    const history = useEntityHistory(props, emit, formData);
    const rev = {
      id: 'rev_1',
      content: {
        attributes: { name: 'Preview Name' },
      },
    };

    history.previewHistory(rev);
    expect(formData.value.name).toBe('Preview Name');

    history.exitHistoryPreview();
    expect(history.isPreviewingHistory.value).toBe(false);
    expect(formData.value.name).toBe('Arthur');
  });

  it('calculates diff summary between revisions', () => {
    const history = useEntityHistory(props, emit, formData);

    const prev = { content: { attributes: { name: 'Old', oldKey: 1 } } };
    const curr = { content: { attributes: { name: 'New', newKey: 2 } } };

    const diff = history.getDiffSummary(curr, prev);
    expect(diff).toContain('~ name');
    expect(diff).toContain('+ newKey');
    expect(diff).toContain('- oldKey');
  });

  it('detects changed fields during preview', () => {
    const history = useEntityHistory(props, emit, formData);
    const rev = { id: 'rev_1', content: { data: { name: 'Arthur Old' } } };

    history.previewHistory(rev);

    expect(history.isFieldChanged('name')).toBe(true);
  });
});
