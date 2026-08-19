import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projectApi, projectRecordId } from '../project.api';
import * as api from '../../api.client';

vi.mock('../../api.client', () => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
  getProjectConfig: vi.fn(),
  deleteProject: vi.fn(),
  saveProjectConfig: vi.fn(),
}));

describe('projectApi & projectRecordId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('projectRecordId', () => {
    it('cleans up and prefixes with projects:', () => {
      expect(projectRecordId('my-world')).toBe('projects:my-world');
      expect(projectRecordId('projects:my-world')).toBe('projects:my-world');
      expect(projectRecordId('')).toBe('projects:default');
      expect(projectRecordId('`world`')).toBe('projects:world');
    });
  });

  describe('projectApi', () => {
    it('getProjects calls api.getProjects', async () => {
      const mockList = [{ id: 'p1', name: 'Project 1' }];
      vi.mocked(api.getProjects).mockResolvedValueOnce(mockList as any);

      const res = await projectApi.getProjects();

      expect(api.getProjects).toHaveBeenCalled();
      expect(res).toEqual(mockList);
    });

    it('createProject calls api.createProject and returns success: true', async () => {
      vi.mocked(api.createProject).mockResolvedValueOnce(undefined as any);

      const res = await projectApi.createProject({ name: 'New Project' });

      expect(api.createProject).toHaveBeenCalledWith({ name: 'New Project' });
      expect(res).toEqual({ success: true });
    });

    it('getProjectConfig calls api.getProjectConfig', async () => {
      const mockConfig = { type: 'novel', genres: ['fantasy'], calendar: {} };
      vi.mocked(api.getProjectConfig).mockResolvedValueOnce(mockConfig as any);

      const res = await projectApi.getProjectConfig('my-proj');

      expect(api.getProjectConfig).toHaveBeenCalledWith('my-proj');
      expect(res).toEqual(mockConfig);
    });

    it('deleteProject calls api.deleteProject', async () => {
      vi.mocked(api.deleteProject).mockResolvedValueOnce(undefined as any);

      const res = await projectApi.deleteProject('my-proj');

      expect(api.deleteProject).toHaveBeenCalledWith('my-proj');
      expect(res).toEqual({ success: true });
    });

    it('saveProjectConfig calls api.saveProjectConfig', async () => {
      vi.mocked(api.saveProjectConfig).mockResolvedValueOnce(undefined as any);

      const config = { type: 'novel', genres: ['sci-fi'], calendar: null };
      const res = await projectApi.saveProjectConfig('my-proj', config);

      expect(api.saveProjectConfig).toHaveBeenCalledWith('my-proj', config);
      expect(res).toEqual({ success: true });
    });
  });
});
