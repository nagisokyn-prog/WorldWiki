import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useChapterHistory } from '../useChapterHistory';
import * as api from '../../../../../services/api.client';

vi.mock('../../../../../services/api.client', () => ({
  getChapterRevisions: vi.fn(),
  toggleChapterHistoryPin: vi.fn(),
}));

describe('useChapterHistory', () => {
  let currentChapterId: any;
  let currentChapter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    currentChapterId = ref('ch_1');
    currentChapter = ref({
      id: 'ch_1',
      title: 'Chapter 1',
      content: 'Original Text',
      footnotes: { 1: 'fn1' },
    });
  });

  it('toggles history and loads revisions with error handling', async () => {
    const { flushPromises } = await import('@vue/test-utils');
    vi.mocked(api.getChapterRevisions).mockResolvedValueOnce([
      { id: 'rev_1', created_at: '2024-01-01T12:00:00Z', is_pinned: false },
    ] as any);

    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    // Toggle on with valid chapter id
    history.toggleHistory();
    expect(history.showHistory.value).toBe(true);
    await flushPromises();
    expect(history.isLoadingHistory.value).toBe(false);

    // Load with null chapter id
    currentChapterId.value = undefined;
    await history.loadHistory();

    // API error
    currentChapterId.value = 'ch_1';
    vi.mocked(api.getChapterRevisions).mockRejectedValueOnce(new Error('Network error'));
    await history.loadHistory();
  });

  it('previews revisions, restores original data on toggle, and handles nested attributes', () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    // Null chapter check
    const nullChapter = ref(null);
    const historyNull = useChapterHistory('proj_1', currentChapterId, nullChapter);
    historyNull.previewHistory({ id: 'rev_1' });

    // Preview with snap.attributes format
    const revWithAttrs = {
      id: 'rev_attrs',
      content: {
        attributes: {
          title: 'Attr Title',
          content: 'Attr Content',
          footnotes: { 2: 'fn2' },
        },
      },
    };
    history.previewHistory(revWithAttrs);
    expect(currentChapter.value.title).toBe('Attr Title');
    expect(history.previewingRevId.value).toBe('rev_attrs');

    // Click same rev to cancel preview
    history.previewHistory(revWithAttrs);
    expect(currentChapter.value.title).toBe('Chapter 1');
    expect(history.previewingRevId.value).toBeNull();
  });

  it('handles togglePin success and error rollback', async () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);
    const rev = { id: 'rev_1', is_pinned: false };

    // Success
    vi.mocked(api.toggleChapterHistoryPin).mockResolvedValueOnce(undefined as any);
    await history.togglePin(rev);
    expect(rev.is_pinned).toBe(true);

    // Rejection / Error
    vi.mocked(api.toggleChapterHistoryPin).mockRejectedValueOnce(new Error('Pin error'));
    await history.togglePin(rev);
    expect(rev.is_pinned).toBe(true); // toggled to false, then reverted on catch back to true
  });

  it('computes diff summary for first version, all field changes, and identical versions', () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    // First version
    expect(history.getDiffSummary({ content: {} }, null)).toBe('Первая версия');

    // All changes
    const prev = { content: { title: 'T1', content: 'C1', footnotes: { 1: 'a' } } };
    const curr = { content: { title: 'T2', content: 'C2', footnotes: { 1: 'b' } } };
    const diff = history.getDiffSummary(curr, prev);
    expect(diff).toContain('Название');
    expect(diff).toContain('Текст');
    expect(diff).toContain('Сноски');

    // Identical
    expect(history.getDiffSummary(prev, prev)).toBe('Нет визуальных изменений');
  });

  it('computes changedFields for active preview', () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    // No preview active
    expect(history.changedFields.value).toEqual([]);

    history.revisions.value = [
      {
        id: 'rev_diff',
        content: { title: 'Diff Title', content: 'Original Text', footnotes: { 1: 'fn1' } },
      },
    ];

    history.previewHistory(history.revisions.value[0]);
    expect(history.changedFields.value).toEqual(['title']);
  });
});
