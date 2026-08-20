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

    // Toggle off restores data
    history.toggleHistory();
    expect(history.showHistory.value).toBe(false);

    // Load with null chapter id
    currentChapterId.value = undefined;
    await history.loadHistory();

    // API error
    currentChapterId.value = 'ch_1';
    // Null return from api (tests line 51 || [])
    vi.mocked(api.getChapterRevisions).mockResolvedValueOnce(null as any);
    await history.loadHistory();
    expect(history.revisions.value).toEqual([]);

    vi.mocked(api.getChapterRevisions).mockRejectedValueOnce(new Error('Network error'));
    await history.loadHistory();
  });

  it('handles previewHistory when currentChapter fields are empty or null', () => {
    const emptyChapter = ref({ id: 'ch_empty', content: null, title: null, footnotes: null } as any);
    const history = useChapterHistory('proj_1', currentChapterId, emptyChapter);

    history.previewHistory({ id: 'rev_empty', content: {} } as any);
    expect(emptyChapter.value.title).toBe('');
    expect(emptyChapter.value.content).toBe('');
    expect(history.previewingRevId.value).toBe('rev_empty');

    // Cancel preview to restore empty
    history.previewHistory({ id: 'rev_empty', content: {} } as any);
    expect(history.previewingRevId.value).toBeNull();
  });

  it('previews revisions, restores original data on toggle, and handles nested attributes', () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    // Null chapter check
    const nullChapter = ref(null);
    const historyNull = useChapterHistory('proj_1', currentChapterId, nullChapter);
    historyNull.previewHistory({ id: 'rev_1' } as any);

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
    history.previewHistory(revWithAttrs as any);
    expect(currentChapter.value.title).toBe('Attr Title');
    expect(history.previewingRevId.value).toBe('rev_attrs');

    // Click same rev to cancel preview
    history.previewHistory(revWithAttrs as any);
    expect(currentChapter.value.title).toBe('Chapter 1');
    expect(history.previewingRevId.value).toBeNull();
  });

  it('handles togglePin success and error rollback with and without chapter ID', async () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);
    const rev: any = { id: 'rev_1', is_pinned: false };

    // Success
    vi.mocked(api.toggleChapterHistoryPin).mockResolvedValueOnce(undefined as any);
    await history.togglePin(rev);
    expect(rev.is_pinned).toBe(true);

    // Rejection / Error
    vi.mocked(api.toggleChapterHistoryPin).mockRejectedValueOnce(new Error('Pin error'));
    await history.togglePin(rev);
    expect(rev.is_pinned).toBe(true); // reverted

    // Without chapter ID
    currentChapterId.value = undefined;
    await history.togglePin(rev);
  });

  it('computes diff summary for first version, all field changes, nested attributes, and identical versions', () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    // First version
    expect(history.getDiffSummary({ content: {} } as any, undefined)).toBe('Первая версия');

    // All changes with attributes format
    const prev = { content: { attributes: { title: 'T1', content: 'C1', footnotes: { 1: 'a' } } } };
    const curr = { content: { attributes: { title: 'T2', content: 'C2', footnotes: { 1: 'b' } } } };
    const diff = history.getDiffSummary(curr as any, prev as any);
    expect(diff).toContain('Название');
    expect(diff).toContain('Текст');
    expect(diff).toContain('Сноски');

    // Identical
    expect(history.getDiffSummary(prev as any, prev as any)).toBe('Нет визуальных изменений');

    // Empty content objects
    expect(history.getDiffSummary({ id: '1' } as any, { id: '2' } as any)).toBe('Нет визуальных изменений');
  });

  it('computes changedFields for active preview including all combinations of changed fields and missing rev', () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    // No preview active
    expect(history.changedFields.value).toEqual([]);

    history.revisions.value = [
      {
        id: 'rev_all',
        content: { title: 'Diff Title', content: 'Diff Content', footnotes: { 2: 'fn2' } },
      },
      {
        id: 'rev_content_only',
        content: { title: 'Chapter 1', content: 'Diff Content', footnotes: { 1: 'fn1' } },
      },
      {
        id: 'rev_footnotes_only',
        content: { title: 'Chapter 1', content: 'Original Text', footnotes: { 99: 'other' } },
      },
      {
        id: 'rev_no_content',
      } as any,
    ];

    // All fields
    history.previewHistory(history.revisions.value[0]);
    expect(history.changedFields.value).toEqual(['title', 'content', 'footnotes']);

    // Content only
    history.previewHistory(history.revisions.value[1]);
    expect(history.changedFields.value).toEqual(['content']);

    // Footnotes only
    history.previewHistory(history.revisions.value[2]);
    expect(history.changedFields.value).toEqual(['footnotes']);

    // No content
    history.previewHistory(history.revisions.value[3]);
    expect(history.changedFields.value).toEqual(['title', 'content', 'footnotes']);

    // Revision ID not found in list
    history.previewingRevId.value = 'unknown_rev';
    expect(history.changedFields.value).toEqual([]);
  });
});
