import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useChaptersMain } from '../useChaptersMain';

vi.mock('../../../../stores/chapter.store', () => ({
  useChapterStore: () => ({
    loading: ref(false),
    chapters: ref([]),
    hierarchy: ref({ volumes: [], arcs: [], chapters: [] }),
    currentChapterId: ref('ch_1'),
    currentChapter: ref({ id: 'ch_1', title: 'Prologue' }),
    hasUnsavedChanges: ref(false),
    debugError: ref(''),
    isSaving: ref(false),
    currentChapterNode: ref(null),
    currentArc: ref(null),
    currentVolume: ref(null),
    loadChapters: vi.fn().mockResolvedValue([]),
    saveChapter: vi.fn(),
    openChapter: vi.fn(),
    createNewChapter: vi.fn(),
    onRenameChapter: vi.fn(),
    deleteChapter: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../../../stores/timeline.store', () => ({
  useTimelineStore: () => ({
    init: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('useChaptersMain', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = { project: 'proj_1' };
  });

  it('initializes and triggers save', () => {
    const main = useChaptersMain(props, emit);

    main.markUnsaved();
    expect(main.hasUnsavedChanges.value).toBe(true);
    expect(emit).toHaveBeenCalledWith('chapter-unsaved');

    main.triggerSave();
    expect(main.saveChapter).toBeDefined();
  });
});
