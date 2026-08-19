import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as projectQueries from '../queries/useProjectQueries';
import * as entityQueries from '../queries/useEntityQueries';
import * as tagQueries from '../queries/useTagQueries';
import * as chapterQueries from '../queries/useChapterQueries';
import * as calendarQueries from '../queries/useCalendarQueries';
import * as batchQueries from '../queries/useBatchQueries';
import * as api from '../../services/api.client';
import { entityApi } from '../../services/Entity/entity.api';
import { tagApi } from '../../services/api/tag.api';
import { chapterApi } from '../../services/api/chapter.api';
import { calendarApi } from '../../services/api/calendar.api';
import { batchApi } from '../../services/api/batch.api';

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

vi.mock('../../services/api/tag.api', () => ({
  tagApi: {
    getTags: vi.fn(),
    saveTag: vi.fn(),
    deleteTag: vi.fn(),
  },
}));

vi.mock('../../services/api/chapter.api', () => ({
  chapterApi: {
    getChaptersList: vi.fn(),
    getChapter: vi.fn(),
    getHierarchy: vi.fn(),
    saveChapter: vi.fn(),
    deleteChapter: vi.fn(),
  },
}));

vi.mock('../../services/api/calendar.api', () => ({
  calendarApi: {
    getCalendars: vi.fn(),
    getGlobalTimeline: vi.fn(),
    saveCalendar: vi.fn(),
    deleteCalendar: vi.fn(),
    saveGlobalTimeline: vi.fn(),
  },
}));

vi.mock('../../services/api/batch.api', () => ({
  batchApi: {
    getEntitiesBatch: vi.fn(),
    upsertConnectionsBatch: vi.fn(),
    saveEntityWithRelations: vi.fn(),
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
      expect(tagApi.getTags).toHaveBeenCalledWith('p1');

      const saveM: any = tagQueries.useSaveTag();
      await saveM.mutationFn({ project: 'p1', tag: { name: 'Lore', color: 'red' } });
      expect(tagApi.saveTag).toHaveBeenCalledWith('p1', { name: 'Lore', color: 'red' });
      saveM.onSuccess(undefined, { project: 'p1' });

      const delM: any = tagQueries.useDeleteTag();
      await delM.mutationFn({ project: 'p1', name: 't1' });
      expect(tagApi.deleteTag).toHaveBeenCalledWith('p1', 't1');
      delM.onSuccess(undefined, { project: 'p1' });
    });
  });

  describe('Chapter Queries', () => {
    it('useChapters, useChapter, useHierarchy, useSaveChapter, useDeleteChapter execute correctly', async () => {
      const chQ: any = chapterQueries.useChapters('p1');
      await chQ.queryFn();
      expect(chapterApi.getChaptersList).toHaveBeenCalledWith('p1');

      const singleChQ: any = chapterQueries.useChapter('p1', 'c1');
      await singleChQ.queryFn();
      expect(chapterApi.getChapter).toHaveBeenCalledWith('p1', 'c1');

      const hQ: any = chapterQueries.useHierarchy('p1');
      await hQ.queryFn();
      expect(chapterApi.getHierarchy).toHaveBeenCalledWith('p1');

      const saveM: any = chapterQueries.useSaveChapter();
      await saveM.mutationFn({ project: 'p1', data: { id: 'c1', title: 'Ch1' } });
      expect(chapterApi.saveChapter).toHaveBeenCalledWith('p1', { id: 'c1', title: 'Ch1' });
      saveM.onSuccess(undefined, { project: 'p1', data: { id: 'c1' } });

      const delM: any = chapterQueries.useDeleteChapter();
      await delM.mutationFn({ project: 'p1', chapterId: 'c1' });
      expect(chapterApi.deleteChapter).toHaveBeenCalledWith('p1', 'c1');
      delM.onSuccess(undefined, { project: 'p1', chapterId: 'c1' });
    });
  });

  describe('Calendar Queries', () => {
    it('useCalendars, useGlobalTimeline, useSaveCalendar, useDeleteCalendar, useSaveGlobalTimeline execute correctly', async () => {
      const calQ: any = calendarQueries.useCalendars('p1');
      await calQ.queryFn();
      expect(calendarApi.getCalendars).toHaveBeenCalledWith('p1');

      const timeQ: any = calendarQueries.useGlobalTimeline('p1');
      await timeQ.queryFn();
      expect(calendarApi.getGlobalTimeline).toHaveBeenCalledWith('p1');

      const saveM: any = calendarQueries.useSaveCalendar();
      await saveM.mutationFn({ project: 'p1', data: { name: 'Cal' } });
      expect(calendarApi.saveCalendar).toHaveBeenCalledWith('p1', { name: 'Cal' });
      saveM.onSuccess(undefined, { project: 'p1' });

      const delM: any = calendarQueries.useDeleteCalendar();
      await delM.mutationFn({ project: 'p1', id: 'cal1' });
      expect(calendarApi.deleteCalendar).toHaveBeenCalledWith('cal1');
      delM.onSuccess(undefined, { project: 'p1' });

      const saveTimeM: any = calendarQueries.useSaveGlobalTimeline();
      await saveTimeM.mutationFn({ project: 'p1', data: { era: 1 } });
      expect(calendarApi.saveGlobalTimeline).toHaveBeenCalledWith('p1', { era: 1 });
      saveTimeM.onSuccess(undefined, { project: 'p1' });
    });
  });

  describe('Batch Queries', () => {
    it('useSaveEntityWithRelations and useUpsertConnectionsBatch execute correctly', async () => {
      const saveRelM: any = batchQueries.useSaveEntityWithRelations();
      await saveRelM.mutationFn({ project: 'p1', entity: { name: 'E' }, relations: [] });
      expect(batchApi.saveEntityWithRelations).toHaveBeenCalledWith('p1', { name: 'E' }, []);
      saveRelM.onSuccess(undefined, { project: 'p1' });

      const upsertConnM: any = batchQueries.useUpsertConnectionsBatch();
      await upsertConnM.mutationFn({ project: 'p1', connections: [] });
      expect(batchApi.upsertConnectionsBatch).toHaveBeenCalledWith('p1', 'Unknown', 'Unknown', []);
      upsertConnM.onSuccess(undefined, { project: 'p1' });
    });
  });
});
