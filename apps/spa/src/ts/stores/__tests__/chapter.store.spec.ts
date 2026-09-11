import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChapterStore } from '../chapter.store';
import { chapterService } from '../../services/chapter.service';
import { useTimelineStore } from '../timeline.store';
import { useCalendarStore } from '../calendar.store';
import * as api from '../../services/api.client';

vi.mock('../../services/api.client', () => ({
  getChapterHierarchy: vi.fn(),
  assignChapter: vi.fn(),
}));

vi.mock('../../services/chapter.service', () => ({
  chapterService: {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    createNew: vi.fn((title) => ({
      id: 'new_ch_id',
      title,
      content: '',
      timeline_events: [],
      participants: [],
      footnotes: {},
    })),
    updateIndex: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('chapter.store', () => {
  let store: ReturnType<typeof useChapterStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useChapterStore();
  });

  describe('loadChapters and hierarchy', () => {
    it('loads hierarchy and updates store state', async () => {
      const mockHierarchy = {
        volumes: [{ id: 'vol_1', title: 'Volume 1' }],
        chapters: [{ id: 'ch_1', title: 'Chapter 1', volume_id: 'vol_1' }],
      };
      vi.mocked(api.getChapterHierarchy).mockResolvedValue(mockHierarchy);

      await store.loadChapters('project_1');

      expect(store.hierarchy).toEqual(mockHierarchy);
      expect(store.loading).toBe(false);
      expect(store.debugError).toBeNull();
    });

    it('handles loadHierarchy error gracefully', async () => {
      vi.mocked(api.getChapterHierarchy).mockRejectedValue(new Error('Fetch failed'));

      await store.loadHierarchy('project_1');

      expect(store.loading).toBe(false);
      expect(store.debugError).toContain('Ошибка загрузки иерархии');
    });
  });

  describe('openChapter & Computed relations', () => {
    it('opens existing chapter and populates currentChapterNode, currentVolume', async () => {
      store.hierarchy = {
        volumes: [{ id: 'vol_1', title: 'Volume 1' }] as any,
        chapters: [{ id: 'ch_1', title: 'Chapter 1', volume_id: 'vol_1' }] as any,
      };

      const fullChapter = {
        id: 'ch_1',
        title: 'Chapter 1',
        content: 'Once upon a time...',
        participants: [],
      };
      vi.mocked(chapterService.get).mockResolvedValue(fullChapter as any);

      const success = await store.openChapter('project_1', 'ch_1');

      expect(success).toBe(true);
      expect(store.currentChapterId).toBe('ch_1');
      expect(store.currentChapter).toEqual(expect.objectContaining({ id: 'ch_1' }));
      expect(store.currentChapterNode?.id).toBe('ch_1');
      expect(store.currentVolume?.id).toBe('vol_1');
    });

    it('returns false when chapter is not found', async () => {
      vi.mocked(chapterService.get).mockResolvedValue(null as any);

      const success = await store.openChapter('project_1', 'non_existent');

      expect(success).toBe(false);
      expect(store.currentChapter).toBeNull();
    });

    it('handles service exception in openChapter', async () => {
      vi.mocked(chapterService.get).mockRejectedValue(new Error('Network error'));

      const success = await store.openChapter('project_1', 'ch_err');

      expect(success).toBe(false);
      expect(store.debugError).toContain('Ошибка загрузки главы');
    });

    it('automatically parses participants if timelineStore finds characters in text', async () => {
      const timelineStore = useTimelineStore();
      vi.spyOn(timelineStore, 'parseParticipants').mockReturnValue([
        { id: 'char_1', type: 'character', name: 'Arthur' } as any,
      ]);

      const fullChapter = {
        id: 'ch_1',
        title: 'Chapter 1',
        content: 'Arthur went to the forest.',
        participants: [],
      };
      vi.mocked(chapterService.get).mockResolvedValue(fullChapter as any);

      await store.openChapter('project_1', 'ch_1');

      expect(store.currentChapter?.participants?.length).toBe(1);
      expect(store.currentChapter?.participants?.[0]).toEqual(
        expect.objectContaining({ id: 'char_1', autoParsed: true })
      );
    });
  });

  describe('saveChapter', () => {
    it('saves current chapter and sets hasUnsavedChanges to false', async () => {
      store.currentChapter = {
        id: 'ch_1',
        title: 'Updated Chapter',
        content: 'New content',
        participants: [],
      } as any;
      store.hasUnsavedChanges = true;
      store.currentChapterId = 'ch_1';
      store.chapters = [{ id: 'ch_1', title: 'Old Chapter' }] as any;

      const emitFn = vi.fn();
      const success = await store.saveChapter('project_1', emitFn);

      expect(success).toBe(true);
      expect(chapterService.save).toHaveBeenCalledWith('project_1', store.currentChapter);
      expect(store.hasUnsavedChanges).toBe(false);
      expect(emitFn).toHaveBeenCalledWith('chapter-saved');
      expect(store.chapters[0].title).toBe('Updated Chapter');
      expect(chapterService.updateIndex).toHaveBeenCalledWith('project_1');
    });

    it('returns false when saveChapter fails', async () => {
      store.currentChapter = { id: 'ch_1', content: '' } as any;
      vi.mocked(chapterService.save).mockRejectedValue(new Error('Disk full'));

      const res = await store.saveChapter('project_1');
      expect(res).toBe(false);
      expect(store.debugError).toContain('Ошибка сохранения');
    });
  });

  describe('createNewChapter', () => {
    it('creates Chapter 1 with default timeline event from calendar', async () => {
      store.hierarchy = { volumes: [], chapters: [] };

      const calStore = useCalendarStore();
      vi.spyOn(calStore, 'loadCalendar').mockResolvedValue({
        точка_отсчета: { эпоха: 1, год: 100, месяц: 2, день: 5 },
      } as any);

      vi.mocked(chapterService.save).mockResolvedValue('chapters:new_ch_id' as any);
      vi.mocked(chapterService.get).mockResolvedValue({ id: 'new_ch_id', title: 'Глава 1' } as any);
      vi.mocked(api.getChapterHierarchy).mockResolvedValue({ volumes: [], chapters: [] });

      const newCh = await store.createNewChapter('project_1');

      expect(newCh).toBeDefined();
      expect(newCh.timeline_events.length).toBe(1);
      expect(newCh.timeline_events[0].description).toBe('Начало истории');
    });

    it('creates subsequent chapter with incremented title and assigns relations', async () => {
      store.hierarchy = {
        volumes: [{ id: 'vol_1', title: 'Том 1' }],
        chapters: [
          { id: 'ch_1', title: 'Глава 1', volume_id: 'vol_1' },
          { id: 'ch_2', title: 'Глава 2', volume_id: 'vol_1' },
        ],
      } as any;

      vi.mocked(chapterService.save).mockResolvedValue('chapters:new_ch_id' as any);
      vi.mocked(chapterService.get).mockResolvedValue({ id: 'new_ch_id', title: 'Глава 3' } as any);
      vi.mocked(api.getChapterHierarchy).mockResolvedValue({
        volumes: [],
        chapters: [{ id: 'new_ch_id', title: 'Глава 3' }],
      } as any);

      const newCh = await store.createNewChapter('project_1', 'vol_1');

      expect(newCh).toBeDefined();
      expect(chapterService.createNew).toHaveBeenCalledWith('Глава 3');
      expect(api.assignChapter).toHaveBeenCalledWith('project_1', 'new_ch_id', 'vol_1');
      expect(store.currentChapterId).toBe('new_ch_id');
    });

    it('creates chapter under volume when volumeId is provided and filters chapters correctly', async () => {
      store.hierarchy = {
        volumes: [],
        chapters: [
          { id: 'ch_1', title: 'Глава 1', volume_id: 'vol_1' },
          { id: 'ch_2', title: 'Глава 2', volume_id: 'vol_1' },
          { id: 'ch_3', title: 'Глава 9', volume_id: 'vol_other' },
        ],
      } as any;

      vi.mocked(chapterService.save).mockResolvedValue('chapters:new_vol_ch' as any);
      vi.mocked(chapterService.get).mockResolvedValue({ id: 'new_vol_ch', title: 'Глава 3' } as any);
      vi.mocked(api.getChapterHierarchy).mockResolvedValue({
        volumes: [],
        chapters: [{ id: 'new_vol_ch', title: 'Глава 3' }],
      } as any);

      const newCh = await store.createNewChapter('project_1', 'vol_1');
      expect(newCh).toBeDefined();
      expect(chapterService.createNew).toHaveBeenCalledWith('Глава 3');
    });
  });

  describe('onRenameChapter & deleteChapter', () => {
    it('renames chapter and updates active state if matching', async () => {
      store.currentChapterId = 'ch_1';
      store.currentChapter = { id: 'ch_1', title: 'Old' } as any;

      await store.onRenameChapter('project_1', { id: 'ch_1', title: 'Old' } as any, 'New Title');

      expect(chapterService.save).toHaveBeenCalledWith('project_1', { id: 'ch_1', title: 'New Title' });
      expect(store.currentChapter?.title).toBe('New Title');
    });

    it('renames chapter and does not update active state if not matching', async () => {
      store.currentChapterId = 'ch_other';
      store.currentChapter = { id: 'ch_other', title: 'Other' } as any;

      await store.onRenameChapter('project_1', { id: 'ch_1', title: 'Old' } as any, 'New Title');
      expect(store.currentChapter?.title).toBe('Other');
    });

    it('deletes chapter and resets currentChapter if active', async () => {
      store.currentChapterId = 'ch_1';
      store.currentChapter = { id: 'ch_1' } as any;

      await store.deleteChapter('project_1', 'ch_1');

      expect(chapterService.delete).toHaveBeenCalledWith('project_1', 'ch_1');
      expect(store.currentChapterId).toBeUndefined();
      expect(store.currentChapter).toBeNull();
    });

    it('deletes chapter and does not reset currentChapter if not active', async () => {
      store.currentChapterId = 'ch_active';
      store.currentChapter = { id: 'ch_active' } as any;

      await store.deleteChapter('project_1', 'ch_different');

      expect(chapterService.delete).toHaveBeenCalledWith('project_1', 'ch_different');
      expect(store.currentChapterId).toBe('ch_active');
    });
  });

  describe('Additional branch edge cases', () => {
    it('handles currentVolume directly via chapter.volume_id and volume not found', () => {
      store.hierarchy = {
        volumes: [{ id: 'vol_direct', title: 'Direct Volume' }] as any,
        chapters: [{ id: 'ch_direct', title: 'Direct Chapter', volume_id: 'vol_direct' }] as any,
      };
      store.currentChapterId = 'ch_direct';
      expect(store.currentVolume?.id).toBe('vol_direct');

      // Volume ID not in hierarchy
      store.hierarchy.chapters[0].volume_id = 'non_existent_vol';
      expect(store.currentVolume).toBeNull();
    });

    it('handles saveChapter guards and existing participant deduplication', async () => {
      // 1. null currentChapter
      store.currentChapter = null;
      expect(await store.saveChapter('project_1')).toBe(false);

      // 2. isSaving already true
      store.currentChapter = { id: 'ch_1', content: '', participants: [] } as any;
      store.isSaving = true;
      expect(await store.saveChapter('project_1')).toBe(false);
      store.isSaving = false;

      // 3. Existing participant deduplication + no emitFn + listIdx === -1
      const timeline = useTimelineStore();
      vi.spyOn(timeline, 'parseParticipants').mockReturnValue([
        { id: 'char_1', type: 'character' } as any,
      ]);
      store.currentChapter = {
        id: 'ch_1',
        content: 'Mentions char_1',
        participants: [{ id: 'char_1', type: 'character' }],
      } as any;
      store.chapters = []; // listIdx === -1
      vi.mocked(chapterService.save).mockResolvedValue({} as any);

      const res = await store.saveChapter('project_1'); // no emitFn
      expect(res).toBe(true);
      expect(store.currentChapter?.participants?.length).toBe(1);
    });

    it('handles createNewChapter with volumeId and calendar failure edge cases', async () => {
      const calStore = useCalendarStore();

      // 1. volumeId passed
      store.hierarchy = {
        volumes: [{ id: 'vol_1' }] as any,
        chapters: [{ id: 'ch_1', volume_id: 'vol_1', title: 'Глава 1' }] as any,
      };
      vi.mocked(chapterService.save).mockResolvedValue('chapters:new_ch_2' as any);
      vi.mocked(chapterService.get).mockResolvedValue({ id: 'new_ch_2', title: 'Глава 2' } as any);
      vi.mocked(api.getChapterHierarchy).mockResolvedValue({ volumes: [], chapters: [] } as any);

      await store.createNewChapter('project_1', 'vol_1');
      expect(api.assignChapter).toHaveBeenCalledWith('project_1', 'new_ch_id', 'vol_1');

      // 2. Chapter 1 with loadCalendar returning null
      store.hierarchy = { volumes: [], chapters: [] };
      vi.spyOn(calStore, 'loadCalendar').mockResolvedValueOnce(null);
      const ch1 = await store.createNewChapter('project_1');
      expect(ch1.timeline_events).toEqual([]);

      // 3. Chapter 1 with loadCalendar throwing error
      vi.spyOn(calStore, 'loadCalendar').mockRejectedValueOnce(new Error('Calendar load failed'));
      const ch2 = await store.createNewChapter('project_1');
      expect(ch2.timeline_events).toEqual([]);
    });
  });
});
