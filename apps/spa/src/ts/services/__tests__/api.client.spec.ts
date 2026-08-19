import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../api.client';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('api.client (Tauri invoke contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Project endpoints', () => {
    it('getProjects invokes get_projects', async () => {
      vi.mocked(invoke).mockResolvedValue(['p1']);
      const res = await api.getProjects();
      expect(invoke).toHaveBeenCalledWith('get_projects');
      expect(res).toEqual(['p1']);
    });

    it('createProject invokes create_project with payload', async () => {
      vi.mocked(invoke).mockResolvedValue('proj_id');
      const res = await api.createProject({ name: 'World' });
      expect(invoke).toHaveBeenCalledWith('create_project', { projectData: { name: 'World' } });
      expect(res).toBe('proj_id');
    });

    it('getProjectConfig invokes get_project_config', async () => {
      vi.mocked(invoke).mockResolvedValue({ type: 'novel' });
      const res = await api.getProjectConfig('my_project');
      expect(invoke).toHaveBeenCalledWith('get_project_config', { name: 'my_project' });
      expect(res).toEqual({ type: 'novel' });
    });

    it('deleteProject invokes delete_project', async () => {
      vi.mocked(invoke).mockResolvedValue('ok');
      await api.deleteProject('my_project');
      expect(invoke).toHaveBeenCalledWith('delete_project', { name: 'my_project' });
    });
  });

  describe('Entity endpoints', () => {
    it('getEntities invokes get_entities with project and entityType', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getEntities('proj_1', 'character');
      expect(invoke).toHaveBeenCalledWith('get_entities', { project: 'proj_1', entityType: 'character' });
    });

    it('getEntity invokes get_entity with id', async () => {
      vi.mocked(invoke).mockResolvedValue({ id: 'char_1' });
      const res = await api.getEntity('char_1');
      expect(invoke).toHaveBeenCalledWith('get_entity', { id: 'char_1' });
      expect(res).toEqual({ id: 'char_1' });
    });

    it('saveEntity invokes save_entity', async () => {
      const entity: any = { id: 'e1', name: 'Hero' };
      vi.mocked(invoke).mockResolvedValue(entity);
      await api.saveEntity('proj_1', entity);
      expect(invoke).toHaveBeenCalledWith('save_entity', { project: 'proj_1', entity });
    });

    it('deleteEntity invokes delete_entity', async () => {
      await api.deleteEntity('e1');
      expect(invoke).toHaveBeenCalledWith('delete_entity', { id: 'e1' });
    });

    it('searchEntities invokes search_entities', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.searchEntities('proj_1', 'query', 'location');
      expect(invoke).toHaveBeenCalledWith('search_entities', { project: 'proj_1', query: 'query', entityType: 'location' });
    });
  });

  describe('Schema & History endpoints', () => {
    it('getEntitySchemas invokes get_entity_schemas', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getEntitySchemas('proj_1');
      expect(invoke).toHaveBeenCalledWith('get_entity_schemas', { project: 'proj_1' });
    });

    it('toggleSchemaHistoryPin invokes toggle_schema_history_pin', async () => {
      await api.toggleSchemaHistoryPin('hist_1', true);
      expect(invoke).toHaveBeenCalledWith('toggle_schema_history_pin', { historyId: 'hist_1', isPinned: true });
    });
  });

  describe('Chapter endpoints', () => {
    it('getChapterHierarchy invokes get_chapter_hierarchy', async () => {
      vi.mocked(invoke).mockResolvedValue({ volumes: [], arcs: [], chapters: [] });
      await api.getChapterHierarchy('proj_1');
      expect(invoke).toHaveBeenCalledWith('get_chapter_hierarchy', { project: 'proj_1' });
    });

    it('assignChapter invokes assign_chapter', async () => {
      await api.assignChapter('proj_1', 'ch1', 'arc1', 'vol1');
      expect(invoke).toHaveBeenCalledWith('assign_chapter', {
        project: 'proj_1',
        chapterId: 'ch1',
        arcId: 'arc1',
        volumeId: 'vol1',
      });
    });
  });

  describe('Tags & Calendars', () => {
    it('getTags invokes get_tags', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getTags('proj_1');
      expect(invoke).toHaveBeenCalledWith('get_tags', { project: 'proj_1' });
    });

    it('saveCalendar invokes save_calendar', async () => {
      const cal: any = { name: 'Cal 1' };
      await api.saveCalendar('proj_1', cal);
      expect(invoke).toHaveBeenCalledWith('save_calendar', { project: 'proj_1', data: cal });
    });

    it('deleteCalendar invokes delete_calendar', async () => {
      await api.deleteCalendar('cal_1');
      expect(invoke).toHaveBeenCalledWith('delete_calendar', { id: 'cal_1' });
    });
  });
});
