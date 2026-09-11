import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chapterApi } from '../chapter.api';
import * as api from '../../api.client';
import { invoke, processIds } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn(),
  processIds: vi.fn((x) => x),
  stringifyId: vi.fn((x) => (typeof x === 'object' && x?.id ? String(x.id) : String(x))),
}));

vi.mock('../../api.client', () => ({
  getChapters: vi.fn(),
  getChapter: vi.fn(),
  saveChapter: vi.fn(),
  assignChapter: vi.fn(),
}));

describe('chapterApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChaptersList', () => {
    it('fetches and processes chapter list', async () => {
      const mockList = [{ id: 'ch1', title: 'Chapter 1' }];
      vi.mocked(api.getChapters).mockResolvedValueOnce(mockList as any);

      const res = await chapterApi.getChaptersList('my-project');

      expect(api.getChapters).toHaveBeenCalledWith('my-project');
      expect(processIds).toHaveBeenCalled();
      expect(res).toEqual(mockList);
    });
  });

  describe('getChapter', () => {
    it('fetches and processes single chapter', async () => {
      const mockChapter = { id: 'ch1', title: 'Intro' };
      vi.mocked(api.getChapter).mockResolvedValueOnce(mockChapter as any);

      const res = await chapterApi.getChapter('my-project', 'ch1');

      expect(api.getChapter).toHaveBeenCalledWith('ch1');
      expect(res).toEqual(mockChapter);
    });
  });

  describe('saveChapter', () => {
    it('saves chapter with volume and content', async () => {
      vi.mocked(api.saveChapter).mockResolvedValueOnce({ id: 'chapters:ch1' } as any);
      vi.mocked(api.assignChapter).mockResolvedValueOnce(undefined as any);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const input = {
        id: 'chapters:ch1',
        title: 'Prologue',
        volume_id: 'vol1',
        content: '<p>Hello</p>',
      };

      const res = await chapterApi.saveChapter('my-proj', input);

      expect(api.saveChapter).toHaveBeenCalledWith('my-proj', {
        ...input,
        project_id: 'projects:my-proj',
      });
      expect(api.assignChapter).toHaveBeenCalledWith('my-proj', 'ch1', 'vol1');
      expect(invoke).toHaveBeenCalledWith('save_text_blocks', {
        project: 'my-proj',
        chapterId: 'chapters:ch1',
        html: '<p>Hello</p>',
      });
      expect(res).toEqual({ success: true, id: 'chapters:ch1' });
    });

    it('handles assignChapter warning and text blocks error gracefully', async () => {
      vi.mocked(api.saveChapter).mockResolvedValueOnce({} as any);
      vi.mocked(api.assignChapter).mockRejectedValueOnce(new Error('Assign error'));
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Text blocks error'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const input = {
        id: 'ch2',
        volume_id: 'vol1',
        content: '<p>Content</p>',
      };

      const res = await chapterApi.saveChapter('my-proj', input);

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
      expect(res).toEqual({ success: true, id: 'ch2' });
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('handles saveChapter with content but without id', async () => {
      vi.mocked(api.saveChapter).mockResolvedValueOnce({ id: 'new_id' } as any);
      const res = await chapterApi.saveChapter('my-proj', { content: '<p>Only content</p>' });
      expect(res).toEqual({ success: true, id: 'new_id' });
    });
  });

  describe('deleteChapter & revisions', () => {
    it('deleteChapter calls delete_chapter invoke', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ success: true });

      const res = await chapterApi.deleteChapter('p1', 'ch1');

      expect(invoke).toHaveBeenCalledWith('delete_chapter', { id: 'ch1' });
      expect(res).toEqual({ success: true });
    });

    it('getChapterRevisions calls get_chapter_revisions invoke', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([{ id: 'rev1' }]);

      const res = await chapterApi.getChapterRevisions('p1', 'ch1');

      expect(invoke).toHaveBeenCalledWith('get_chapter_revisions', { project: 'p1', chapterId: 'ch1' });
      expect(res).toEqual([{ id: 'rev1' }]);
    });

    it('toggleChapterHistoryPin calls toggle_chapter_history_pin', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await chapterApi.toggleChapterHistoryPin('hist1', true);

      expect(invoke).toHaveBeenCalledWith('toggle_chapter_history_pin', { historyId: 'hist1', isPinned: true });
    });
  });

  describe('Hierarchy methods', () => {
    it('getHierarchy calls get_chapter_hierarchy and processes items', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        volumes: [{ id: 'v1' }],
        chapters: [{ id: 'c1' }],
      });

      const res = await chapterApi.getHierarchy('p1');

      expect(invoke).toHaveBeenCalledWith('get_chapter_hierarchy', { project: 'p1' });
      expect(res.volumes.length).toBe(1);
      expect(res.chapters.length).toBe(1);

      // when volumes, chapters are undefined
      vi.mocked(invoke).mockResolvedValueOnce({});
      const emptyRes = await chapterApi.getHierarchy('p1');
      expect(emptyRes).toEqual({ volumes: [], chapters: [] });
    });

    it('createVolume, updateVolume, deleteVolume', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: 'vol_1' });
      const volId = await chapterApi.createVolume('p1', 'Vol 1');
      expect(invoke).toHaveBeenCalledWith('create_volume', { project: 'p1', title: 'Vol 1' });
      expect(volId).toBe('vol_1');

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await chapterApi.updateVolume('p1', 'vol_1', 'Vol 1 Updated');
      expect(invoke).toHaveBeenCalledWith('update_volume', { project: 'p1', id: 'vol_1', title: 'Vol 1 Updated' });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await chapterApi.deleteVolume('p1', 'vol_1');
      expect(invoke).toHaveBeenCalledWith('delete_volume', { id: 'vol_1' });
    });

    it('assignChapter and reorderNode', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await chapterApi.assignChapter('p1', 'ch1', 'vol1');
      expect(invoke).toHaveBeenCalledWith('assign_chapter', { project: 'p1', chapterId: 'ch1', volumeId: 'vol1' });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await chapterApi.reorderNode('p1', 'chapter', 'ch1', 2);
      expect(invoke).toHaveBeenCalledWith('reorder_node', { project: 'p1', nodeType: 'chapter', id: 'ch1', sortOrder: 2 });
    });
  });

  describe('Plan items methods', () => {
    it('getPlanItems filters and sorts plans including items with missing sort_order', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { id: 'p1', parent_type: 'chapter', parent_ref: 'ch1', title: 'Plan 1', completed: false, sort_order: 2 },
        { id: 'p2', parent_type: 'chapter', parent_ref: 'ch1', title: 'Plan 0', completed: true, sort_order: 1 },
        { id: 'p0', parent_type: 'chapter', parent_ref: 'ch1', title: 'Plan No Order', completed: false }, // missing sort_order
        { id: 'p3', parent_type: 'volume', parent_ref: 'v1', title: 'Other' },
      ]);

      const res = await chapterApi.getPlanItems('proj', 'chapter', 'ch1');

      expect(res).toEqual([
        { id: 'p0', parentType: 'chapter', parentId: 'ch1', text: 'Plan No Order', done: false, sort_order: 0 },
        { id: 'p2', parentType: 'chapter', parentId: 'ch1', text: 'Plan 0', done: true, sort_order: 1 },
        { id: 'p1', parentType: 'chapter', parentId: 'ch1', text: 'Plan 1', done: false, sort_order: 2 },
      ]);
    });

    it('savePlanItem saves plan item and returns id', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: 'plan_10' });

      const res = await chapterApi.savePlanItem('proj', {
        id: 'plan_1',
        parentType: 'chapter',
        parentId: 'ch1',
        text: 'Write battle scene',
        done: true,
        sort_order: 3,
      });

      expect(invoke).toHaveBeenCalledWith('save_plan', {
        data: {
          id: 'plan_1',
          project_id: 'projects:proj',
          title: 'Write battle scene',
          parent_ref: 'ch1',
          parent_type: 'chapter',
          sort_order: 3,
          completed: true,
        },
      });
      expect(res).toBe('plan_10');
    });

    it('deletePlanItem calls delete_plan', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await chapterApi.deletePlanItem('proj', 'p1');

      expect(invoke).toHaveBeenCalledWith('delete_plan', { id: 'p1' });
    });

    it('togglePlanItem flips completed state', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce({ id: 'p1', completed: false })
        .mockResolvedValueOnce(undefined);

      const res = await chapterApi.togglePlanItem('proj', 'p1');

      expect(invoke).toHaveBeenNthCalledWith(1, 'get_plan', { id: 'p1' });
      expect(invoke).toHaveBeenNthCalledWith(2, 'save_plan', { data: { id: 'p1', completed: true } });
      expect(res).toBe(true);
    });

    it('togglePlanItem returns false if plan not found', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(null);

      const res = await chapterApi.togglePlanItem('proj', 'p1');

      expect(res).toBe(false);
    });

    it('handles default arguments for chapter assignment, and savePlanItem', async () => {
      // 1. assignChapter with default null
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await chapterApi.assignChapter('p1', 'ch1');
      expect(invoke).toHaveBeenCalledWith('assign_chapter', { project: 'p1', chapterId: 'ch1', volumeId: null });

      // 2. getPlanItems when get_plans returns null
      vi.mocked(invoke).mockResolvedValueOnce(null);
      const emptyPlans = await chapterApi.getPlanItems('p1', 'chapter', 'ch1');
      expect(emptyPlans).toEqual([]);

      // 3. savePlanItem without optional fields
      vi.mocked(invoke).mockResolvedValueOnce({ id: 'plan_def' });
      await chapterApi.savePlanItem('p1', {
        parentType: 'chapter',
        parentId: 'ch1',
        text: 'Minimal Plan',
      });
      expect(invoke).toHaveBeenCalledWith('save_plan', {
        data: {
          id: null,
          project_id: 'projects:p1',
          title: 'Minimal Plan',
          parent_ref: 'ch1',
          parent_type: 'chapter',
          sort_order: 0,
          completed: false,
        },
      });
    });
  });
});
