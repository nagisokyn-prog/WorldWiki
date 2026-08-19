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

  describe('Additional branch edge cases for useEntityHistory', () => {
    it('handles errors in togglePin and loadHistory', async () => {
      // togglePin error catch
      vi.mocked(api.toggleEntityHistoryPin).mockRejectedValueOnce(new Error('Pin error'));
      const history = useEntityHistory(props, emit, formData);
      await history.togglePin({ id: 'r1', is_pinned: false });

      // loadHistory without project, entityId, or tauri
      const historyNoProps = useEntityHistory({}, emit, formData);
      await historyNoProps.loadHistory();

      // loadHistory error catch
      vi.mocked((window as any).__TAURI__.core.invoke).mockRejectedValueOnce(new Error('Invoke error'));
      await history.loadHistory();
      expect(history.isLoadingHistory.value).toBe(false);
    });

    it('handles restoreHistory guards and diff summary edge cases', () => {
      const history = useEntityHistory(props, emit, formData);

      // restoreHistory without previewingRevId
      history.restoreHistory();

      // restoreHistory when rev has no content
      history.previewingRevId.value = 'non_existent';
      history.restoreHistory();

      // getDiffSummary with null previous and empty changes
      expect(history.getDiffSummary({}, null)).toBe('');
      expect(history.getDiffSummary({ content: { name: 'same' } }, { content: { name: 'same' } })).toBe('Без изменений');

      // isFieldChanged when not previewing
      expect(history.isFieldChanged('name')).toBe(false);
    });
  });
});

