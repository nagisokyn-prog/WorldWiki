import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as projectQueries from '../queries/useProjectQueries';
import * as entityQueries from '../queries/useEntityQueries';
import * as tagQueries from '../queries/useTagQueries';
import * as chapterQueries from '../queries/useChapterQueries';
import * as calendarQueries from '../queries/useCalendarQueries';
import * as batchQueries from '../queries/useBatchQueries';
import * as api from '../../services/api.client';
import { entityApi } from '../../services/Entity/entity.api';

vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn((opts) => opts),
  useMutation: vi.fn((opts) => opts),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
  })),
}));

vi.mock('../../services/api.client', () => ({
  getProjects: vi.fn(),
  getProjectConfig: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  saveProjectConfig: vi.fn(),
  getEntitySchemas: vi.fn(),
  getTags: vi.fn(),
  saveTag: vi.fn(),
  deleteTag: vi.fn(),
  getChapters: vi.fn(),
  saveChapter: vi.fn(),
  deleteChapter: vi.fn(),
  getChapterHierarchy: vi.fn(),
  getCalendars: vi.fn(),
  saveCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
  getEntitiesBatch: vi.fn(),
}));

vi.mock('../../services/Entity/entity.api', () => ({
  entityApi: {
    getEntityList: vi.fn(),
    getEntity: vi.fn(),
    getSchemas: vi.fn(),
    saveEntity: vi.fn(),
    deleteEntity: vi.fn(),
  },
}));

describe('TanStack Query Composables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Project Queries', () => {
    it('useProjects invokes api.getProjects', async () => {
      const q: any = projectQueries.useProjects();
      expect(q.queryKey).toEqual(['projects']);
      await q.queryFn();
      expect(api.getProjects).toHaveBeenCalled();
    });

    it('useProjectConfig invokes api.getProjectConfig', async () => {
      const q: any = projectQueries.useProjectConfig('test_proj');
      expect(q.queryKey).toEqual(['projects', 'test_proj', 'config']);
      expect(q.enabled).toBe(true);
      await q.queryFn();
      expect(api.getProjectConfig).toHaveBeenCalledWith('test_proj');
    });

    it('useCreateProject mutation triggers invalidation on success', async () => {
      const m: any = projectQueries.useCreateProject();
      await m.mutationFn({ name: 'New' });
      expect(api.createProject).toHaveBeenCalledWith({ name: 'New' });
      m.onSuccess();
    });

    it('useDeleteProject mutation triggers removal on success', async () => {
      const m: any = projectQueries.useDeleteProject();
      await m.mutationFn('proj_1');
      expect(api.deleteProject).toHaveBeenCalledWith('proj_1');
      m.onSuccess(undefined, 'proj_1');
    });

    it('useSaveProjectConfig mutation triggers invalidation', async () => {
      const m: any = projectQueries.useSaveProjectConfig();
      await m.mutationFn({ name: 'proj_1', config: {} as any });
      expect(api.saveProjectConfig).toHaveBeenCalledWith('proj_1', {});
      m.onSuccess(undefined, { name: 'proj_1' });
    });
  });

  describe('Entity Queries', () => {
    it('useEntityList and useEntity invoke entityApi', async () => {
      const listQ: any = entityQueries.useEntityList('p1', 'char');
      expect(listQ.queryKey).toEqual(['entities', 'p1', 'char', undefined]);
      await listQ.queryFn();
      expect(entityApi.getEntityList).toHaveBeenCalledWith('p1', 'char', undefined);

      const singleQ: any = entityQueries.useEntity('p1', 'char', 'id_1');
      await singleQ.queryFn();
      expect(entityApi.getEntity).toHaveBeenCalledWith('p1', 'char', 'id_1');
    });

    it('useSchemas and useEntityTypes invoke api', async () => {
      const schQ: any = entityQueries.useSchemas('p1');
      await schQ.queryFn();
      expect(entityApi.getSchemas).toHaveBeenCalledWith('p1');

      const typesQ: any = entityQueries.useEntityTypes('p1');
      await typesQ.queryFn();
      expect(api.getEntitySchemas).toHaveBeenCalledWith('p1');
    });

    it('useSaveEntity and useDeleteEntity mutations execute correctly', async () => {
      const saveM: any = entityQueries.useSaveEntity();
      await saveM.mutationFn({ project: 'p1', type: 'char', data: { name: 'A' }, id: '1' });
      expect(entityApi.saveEntity).toHaveBeenCalledWith('p1', 'char', { name: 'A' }, '1', undefined);
      saveM.onSuccess(undefined, { project: 'p1', type: 'char', id: '1' });

      const delM: any = entityQueries.useDeleteEntity();
      await delM.mutationFn({ project: 'p1', type: 'char', id: '1' });
      expect(entityApi.deleteEntity).toHaveBeenCalledWith('p1', 'char', '1');
      delM.onSuccess(undefined, { project: 'p1', type: 'char', id: '1' });
    });
  });

  describe('Tag Queries', () => {
    it('useTags, useSaveTag, useDeleteTag execute correctly', async () => {
      const tagsQ: any = tagQueries.useTags('p1');
      await tagsQ.queryFn();
      expect(api.getTags).toHaveBeenCalledWith('p1');

      const saveM: any = tagQueries.useSaveTag();
      await saveM.mutationFn({ project: 'p1', data: { name: 'Lore' } as any });
      expect(api.saveTag).toHaveBeenCalledWith('p1', { name: 'Lore' });
      saveM.onSuccess(undefined, { project: 'p1' });

      const delM: any = tagQueries.useDeleteTag();
      await delM.mutationFn({ project: 'p1', id: 't1' });
      expect(api.deleteTag).toHaveBeenCalledWith('t1');
      delM.onSuccess(undefined, { project: 'p1' });
    });
  });

  describe('Chapter Queries', () => {
    it('useChapters, useChapterHierarchy, useSaveChapter, useDeleteChapter execute correctly', async () => {
      const chQ: any = chapterQueries.useChapters('p1');
      await chQ.queryFn();
      expect(api.getChapters).toHaveBeenCalledWith('p1');

      const hQ: any = chapterQueries.useChapterHierarchy('p1');
      await hQ.queryFn();
      expect(api.getChapterHierarchy).toHaveBeenCalledWith('p1');

      const saveM: any = chapterQueries.useSaveChapter();
      await saveM.mutationFn({ project: 'p1', data: { title: 'Ch1' } as any });
      expect(api.saveChapter).toHaveBeenCalledWith('p1', { title: 'Ch1' });
      saveM.onSuccess(undefined, { project: 'p1' });

      const delM: any = chapterQueries.useDeleteChapter();
      await delM.mutationFn({ project: 'p1', id: 'c1' });
      expect(api.deleteChapter).toHaveBeenCalledWith('c1');
      delM.onSuccess(undefined, { project: 'p1' });
    });
  });

  describe('Calendar Queries', () => {
    it('useCalendars, useSaveCalendar, useDeleteCalendar execute correctly', async () => {
      const calQ: any = calendarQueries.useCalendars('p1');
      await calQ.queryFn();
      expect(api.getCalendars).toHaveBeenCalledWith('p1');

      const saveM: any = calendarQueries.useSaveCalendar();
      await saveM.mutationFn({ project: 'p1', data: { name: 'Cal' } as any });
      expect(api.saveCalendar).toHaveBeenCalledWith('p1', { name: 'Cal' });
      saveM.onSuccess(undefined, { project: 'p1' });

      const delM: any = calendarQueries.useDeleteCalendar();
      await delM.mutationFn({ project: 'p1', id: 'cal1' });
      expect(api.deleteCalendar).toHaveBeenCalledWith('cal1');
      delM.onSuccess(undefined, { project: 'p1' });
    });
  });

  describe('Batch Queries', () => {
    it('useEntitiesBatch executes correctly', async () => {
      const bQ: any = batchQueries.useEntitiesBatch('p1', ['char', 'loc']);
      await bQ.queryFn();
      expect(api.getEntitiesBatch).toHaveBeenCalledWith('p1', ['char', 'loc']);
    });
  });
});
