import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChapterStore } from '../chapter.store';
import { chapterService } from '../../services/chapter.service';
import * as api from '../../services/api.client';

vi.mock('@worldwiki/components', () => ({
  useEditorGroups: vi.fn(),
  settingsService: {
    getSettings: vi.fn(() => ({})),
    saveSettings: vi.fn(),
  },
  appAlert: vi.fn(),
  appConfirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../services/chapter.service', () => ({
  chapterService: {
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    createNew: vi.fn((title) => ({
      id: 'new_ch_id',
      title,
      content: '',
      participants: [],
      timeline_events: [],
      footnotes: {},
    })),
    updateIndex: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../services/api.client', () => ({
  getChapterHierarchy: vi.fn(),
  assignChapter: vi.fn(),
}));

describe('chapter.store', () => {
  let store: ReturnType<typeof useChapterStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useChapterStore();
  });

  describe('loadChapters', () => {
    it('loads hierarchy and updates store state', async () => {
      const mockHierarchy = {
        volumes: [{ id: 'vol_1', title: 'Volume 1' }],
        arcs: [{ id: 'arc_1', title: 'Arc 1', volume_id: 'vol_1' }],
        chapters: [{ id: 'ch_1', title: 'Chapter 1', arc_id: 'arc_1' }],
      };
      vi.mocked(api.getChapterHierarchy).mockResolvedValue(mockHierarchy);

      await store.loadChapters('project_1');

      expect(store.hierarchy).toEqual(mockHierarchy);
      expect(store.loading).toBe(false);
      expect(store.debugError).toBeNull();
    });

    it('handles loadHierarchy error gracefully', async () => {
      vi.mocked(api.getChapterHierarchy).mockRejectedValue(new Error('Fetch failed'));

      await store.loadChapters('project_1');

      expect(store.loading).toBe(false);
      expect(store.debugError).toContain('Ошибка загрузки иерархии');
    });
  });

  describe('openChapter & Computed relations', () => {
    it('opens existing chapter and populates currentChapterNode, arc, volume', async () => {
      store.hierarchy = {
        volumes: [{ id: 'vol_1', title: 'Volume 1' }],
        arcs: [{ id: 'arc_1', title: 'Arc 1', volume_id: 'vol_1' }],
        chapters: [{ id: 'ch_1', title: 'Chapter 1', arc_id: 'arc_1' }],
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
      expect(store.currentArc?.id).toBe('arc_1');
      expect(store.currentVolume?.id).toBe('vol_1');
    });

    it('returns false when chapter is not found', async () => {
      vi.mocked(chapterService.get).mockResolvedValue(null as any);

      const success = await store.openChapter('project_1', 'non_existent');
      expect(success).toBe(false);
    });
  });

  describe('createNewChapter', () => {
    it('creates chapter with incremented title and assigns relations', async () => {
      store.hierarchy = {
        volumes: [],
        arcs: [],
        chapters: [
          { id: 'ch_1', title: 'Глава 1', arc_id: 'arc_1' },
          { id: 'ch_2', title: 'Глава 2', arc_id: 'arc_1' },
        ],
      };

      vi.mocked(chapterService.save).mockResolvedValue('chapters:new_ch_id' as any);
      vi.mocked(chapterService.get).mockResolvedValue({ id: 'new_ch_id', title: 'Глава 3' } as any);
      vi.mocked(api.getChapterHierarchy).mockResolvedValue({
        volumes: [],
        arcs: [],
        chapters: [{ id: 'new_ch_id', title: 'Глава 3' }],
      });

      const newCh = await store.createNewChapter('project_1', 'arc_1');

      expect(chapterService.createNew).toHaveBeenCalledWith('Глава 3');
      expect(api.assignChapter).toHaveBeenCalledWith('project_1', 'new_ch_id', 'arc_1', null);
      expect(store.currentChapterId).toBe('new_ch_id');
    });
  });

  describe('onRenameChapter & deleteChapter', () => {
    it('renames chapter and updates active state if matching', async () => {
      store.currentChapterId = 'ch_1';
      store.currentChapter = { id: 'ch_1', title: 'Old' };

      await store.onRenameChapter('project_1', { id: 'ch_1', title: 'Old' }, 'New Title');

      expect(chapterService.save).toHaveBeenCalledWith('project_1', { id: 'ch_1', title: 'New Title' });
      expect(store.currentChapter.title).toBe('New Title');
    });

    it('deletes chapter and resets currentChapter if active', async () => {
      store.currentChapterId = 'ch_1';
      store.currentChapter = { id: 'ch_1' };

      await store.deleteChapter('project_1', 'ch_1');

      expect(chapterService.delete).toHaveBeenCalledWith('project_1', 'ch_1');
      expect(store.currentChapterId).toBeUndefined();
      expect(store.currentChapter).toBeNull();
    });
  });
});
