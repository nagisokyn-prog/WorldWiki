import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chapterService } from '../chapter.service';
import * as api from '../api.client';

vi.mock('../api.client', () => ({
  getChapters: vi.fn(),
  getChapter: vi.fn(),
  saveChapter: vi.fn(),
  deleteChapter: vi.fn(),
}));

describe('chapterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('calls api.getChapters and returns chapter list', async () => {
      const mockChapters = [{ id: 'ch1', title: 'Chapter 1' }];
      vi.mocked(api.getChapters).mockResolvedValue(mockChapters as any);

      const res = await chapterService.list('project-1');
      expect(api.getChapters).toHaveBeenCalledWith('project-1');
      expect(res).toEqual(mockChapters);
    });
  });

  describe('get', () => {
    it('calls api.getChapter and returns specific chapter', async () => {
      const mockChapter = { id: 'ch1', title: 'Chapter 1', content: 'Text' };
      vi.mocked(api.getChapter).mockResolvedValue(mockChapter as any);

      const res = await chapterService.get('project-1', 'ch1');
      expect(api.getChapter).toHaveBeenCalledWith('ch1');
      expect(res).toEqual(mockChapter);
    });
  });

  describe('save', () => {
    it('formats id and project_id prefix if missing before calling api.saveChapter', async () => {
      vi.mocked(api.saveChapter).mockResolvedValue({} as any);

      const data = { id: 'chapter_123', title: 'Chapter 1' };
      const returnedId = await chapterService.save('my_world', data);

      expect(returnedId).toBe('chapters:chapter_123');
      expect(api.saveChapter).toHaveBeenCalledWith(
        'my_world',
        expect.objectContaining({
          id: 'chapters:chapter_123',
          project_id: 'projects:my_world',
          title: 'Chapter 1',
        })
      );
    });

    it('generates an ID if none provided in data', async () => {
      vi.mocked(api.saveChapter).mockResolvedValue({} as any);

      const data: any = { title: 'Untitled' };
      const returnedId = await chapterService.save('projects:my_world', data);

      expect(returnedId).toMatch(/^chapters:chapter_\d+_/);
      expect(api.saveChapter).toHaveBeenCalledWith(
        'projects:my_world',
        expect.objectContaining({
          id: returnedId,
          project_id: 'projects:my_world',
        })
      );
    });
    it('preserves existing chapters: prefix and project_id prefix', async () => {
      vi.mocked(api.saveChapter).mockResolvedValue({} as any);

      const data = { id: 'chapters:existing_123', title: 'Chapter 1' };
      const returnedId = await chapterService.save('projects:my_world', data);

      expect(returnedId).toBe('chapters:existing_123');
      expect(api.saveChapter).toHaveBeenCalledWith(
        'projects:my_world',
        expect.objectContaining({
          id: 'chapters:existing_123',
          project_id: 'projects:my_world',
        })
      );
    });

    it('formats participants with objects and strings', async () => {
      vi.mocked(api.saveChapter).mockResolvedValue({} as any);

      const data: any = {
        id: 'ch_parts',
        participants: [
          'direct_string',
          { id: 'hero', type: 'character' },
          { id: 'loc:castle', type: 'location' },
          { id: 'no_type' },
          123,
          null,
        ],
      };
      await chapterService.save('my_world', data);

      expect(api.saveChapter).toHaveBeenCalledWith(
        'my_world',
        expect.objectContaining({
          participants: [
            'direct_string',
            'character:hero',
            'loc:castle',
            'no_type',
            '123',
          ],
        })
      );
    });
  });

  describe('delete', () => {
    it('calls api.deleteChapter and returns success status', async () => {
      vi.mocked(api.deleteChapter).mockResolvedValue(undefined as any);

      const res = await chapterService.delete('my_project', 'chapters:ch1');
      expect(api.deleteChapter).toHaveBeenCalledWith('chapters:ch1');
      expect(res).toEqual({ success: true });
    });
  });

  describe('createNew', () => {
    it('creates initial chapter object with default values and fallback title', () => {
      const ch = chapterService.createNew('Глава 1', 'Custom content');
      expect(ch.title).toBe('Глава 1');
      expect(ch.content).toBe('Custom content');
      expect(ch.id).toMatch(/^chapter_\d+_/);
      expect(ch.word_count).toBe(0);
      expect(ch.timeline_events).toEqual([]);
      expect(ch.participants).toEqual([]);
      expect(ch.footnotes).toEqual({});

      const chDefault = chapterService.createNew('');
      expect(chDefault.title).toBe('Новая глава');
      expect(chDefault.content).toContain('Новая глава');
    });
  });

  describe('updateIndex', () => {
    it('returns true', async () => {
      expect(await chapterService.updateIndex('project-1')).toBe(true);
    });
  });
});
