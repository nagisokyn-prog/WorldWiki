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
    currentChapter = ref({ id: 'ch_1', title: 'Chapter 1', content: 'Original Text' });
  });

  it('loads history and formats dates', async () => {
    vi.mocked(api.getChapterRevisions).mockResolvedValueOnce([
      { id: 'rev_1', created_at: '2024-01-01T12:00:00Z', is_pinned: false },
    ] as any);

    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);
    await history.loadHistory();

    expect(history.revisions.value.length).toBe(1);
    expect(history.revisions.value[0].formattedDate).toBeDefined();
  });

  it('previews and toggles pin', async () => {
    vi.mocked(api.toggleChapterHistoryPin).mockResolvedValueOnce(undefined as any);

    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);
    const rev = {
      id: 'rev_1',
      is_pinned: false,
      content: { title: 'Chapter 1 (Old)', content: 'Old Content' },
    };

    history.previewHistory(rev);
    expect(currentChapter.value.title).toBe('Chapter 1 (Old)');

    await history.togglePin(rev);
    expect(api.toggleChapterHistoryPin).toHaveBeenCalledWith('rev_1', true);
  });

  it('computes diff summary', () => {
    const history = useChapterHistory('proj_1', currentChapterId, currentChapter);

    const prev = { content: { title: 'Old Title', content: 'Text' } };
    const curr = { content: { title: 'New Title', content: 'Text' } };

    const diff = history.getDiffSummary(curr, prev);
    expect(diff).toContain('Название');
  });
});
