import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projectService } from '../project.service';
import * as api from '../api.client';
import { clearCache } from '../../utils/requestCache';

vi.mock('../api.client', () => ({
  getProjects: vi.fn(),
  getProjectConfig: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  saveProjectConfig: vi.fn(),
}));

describe('projectService (Contract & Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  describe('getProjects', () => {
    it('returns normalized project list and uses cache on subsequent call', async () => {
      const mockRawProjects = [
        { name: 'World 1', stats: { characters: 5, organizations: 2, states: 1, chapters: 10 } },
        { name: 'World 2', icon: '🌍' }, // missing stats
      ];
      vi.mocked(api.getProjects).mockResolvedValue(mockRawProjects as any);

      const res1 = await projectService.getProjects();
      expect(res1).toHaveLength(2);
      expect(res1[0].icon).toBe('📁');
      expect(res1[0].stats.characters).toBe(5);
      expect(res1[1].icon).toBe('🌍');
      expect(res1[1].stats).toEqual({ characters: 0, organizations: 0, states: 0, chapters: 0 });

      // Second call should return cached data
      const res2 = await projectService.getProjects();
      expect(api.getProjects).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(res1);
    });

    it('handles response wrapped in { projects: [...] } object', async () => {
      vi.mocked(api.getProjects).mockResolvedValue({
        projects: [{ name: 'Wrapped Project' }]
      } as any);

      const res = await projectService.getProjects();
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('Wrapped Project');
    });
  });

  describe('getProjectConfig', () => {
    it('fetches project config and caches result', async () => {
      const mockConfig = { type: 'fantasy', genres: ['high fantasy'] };
      vi.mocked(api.getProjectConfig).mockResolvedValue(mockConfig);

      const res = await projectService.getProjectConfig('my_project');
      expect(api.getProjectConfig).toHaveBeenCalledWith('my_project');
      expect(res).toEqual(mockConfig);

      // Cached call
      await projectService.getProjectConfig('my_project');
      expect(api.getProjectConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe('createProject', () => {
    it('sends cleaned payload without invalid date fields and invalidates cache', async () => {
      vi.mocked(api.createProject).mockResolvedValue('project:new_world');

      const result = await projectService.createProject({
        name: 'New World',
        description: 'Epic fantasy setting',
      });

      expect(api.createProject).toHaveBeenCalledWith({
        name: 'New World',
        description: 'Epic fantasy setting',
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('deleteProject', () => {
    it('deletes project and invalidates related caches', async () => {
      vi.mocked(api.deleteProject).mockResolvedValue('deleted');

      const result = await projectService.deleteProject('old_project');
      expect(api.deleteProject).toHaveBeenCalledWith('old_project');
      expect(result).toEqual({ success: true });
    });
  });

  describe('saveProjectConfig', () => {
    it('saves project config and invalidates config cache', async () => {
      vi.mocked(api.saveProjectConfig).mockResolvedValue({ success: true });

      const newConfig = { type: 'scifi', genres: ['cyberpunk'] };
      const res = await projectService.saveProjectConfig('project_1', newConfig);

      expect(api.saveProjectConfig).toHaveBeenCalledWith('project_1', newConfig);
      expect(res).toEqual({ success: true });
    });
  });

    it('handles null/undefined raw getProjects response', async () => {
      vi.mocked(api.getProjects).mockResolvedValue(null as any);
      const res = await projectService.getProjects();
      expect(res).toEqual([]);
    });

  describe('getProjectMetadata', () => {
    it('combines project config and stats into metadata', async () => {
      vi.mocked(api.getProjectConfig).mockResolvedValue({
        type: 'fantasy',
        genres: ['magic'],
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-02T00:00:00.000Z',
      });
      vi.mocked(api.getProjects).mockResolvedValue([
        { name: 'World 1', stats: { characters: 10, organizations: 3, states: 2, chapters: 5 } }
      ] as any);

      const meta = await projectService.getProjectMetadata('World 1');
      expect(meta.name).toBe('World 1');
      expect(meta.type).toBe('fantasy');
      expect(meta.genres).toEqual(['magic']);
      expect(meta.stats.characters).toBe(10);
    });

    it('uses fallback default values when config and stats are empty', async () => {
      vi.mocked(api.getProjectConfig).mockResolvedValue({} as any);
      vi.mocked(api.getProjects).mockResolvedValue([]);

      const meta = await projectService.getProjectMetadata('Missing Project');
      expect(meta.name).toBe('Missing Project');
      expect(meta.type).toBe('novel');
      expect(meta.genres).toEqual([]);
      expect(meta.created).toBeDefined();
      expect(meta.updated).toBeDefined();
      expect(meta.stats).toEqual({ characters: 0, organizations: 0, states: 0, chapters: 0 });
    });
  });
});
