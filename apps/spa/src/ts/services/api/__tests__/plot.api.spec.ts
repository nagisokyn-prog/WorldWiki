import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plotApi } from '../plot.api';
import * as api from '../../api.client';
import { processIds } from '@worldwiki/components';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { StoryArc } from '@/types/generated/StoryArc';

vi.mock('@worldwiki/components', () => ({
  processIds: vi.fn((x) => x),
  invoke: vi.fn(),
  stringifyId: vi.fn((x) => (typeof x === 'object' && x?.id ? String(x.id) : String(x))),
}));

vi.mock('../../api.client', () => ({
  getPlotPromises: vi.fn(),
  getPlotPromise: vi.fn(),
  savePlotPromise: vi.fn(),
  deletePlotPromise: vi.fn(),
  plantPlotPromise: vi.fn(),
  getStoryArcs: vi.fn(),
  saveStoryArc: vi.fn(),
}));

describe('plotApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlotPromises', () => {
    it('fetches and processes plot promises with stripped project prefix', async () => {
      const mockList: PlotPromise[] = [
        {
          id: 'plot_promises:gun1',
          project_id: 'projects:p1',
          kind: 'gun',
          title: 'Старое ружье',
          note: null,
          status: 'planted',
          milestones: [],
          location_id: null,
          timeline_event_id: null,
          m_abs: null,
          calendar_id: null,
          participant_ids: [],
          arcs: [],
          arc_id: null,
          arc_phase: null,
        },
      ];
      vi.mocked(api.getPlotPromises).mockResolvedValueOnce(mockList as any);

      const res = await plotApi.getPlotPromises('projects:novel_1');

      expect(api.getPlotPromises).toHaveBeenCalledWith('novel_1');
      expect(processIds).toHaveBeenCalled();
      expect(res).toEqual(mockList);
    });

    it('filters out falsy values if any', async () => {
      vi.mocked(api.getPlotPromises).mockResolvedValueOnce([{ id: 'p1' }, null] as any);

      const res = await plotApi.getPlotPromises('test_proj');

      expect(api.getPlotPromises).toHaveBeenCalledWith('test_proj');
      expect(res).toHaveLength(1);
    });
  });

  describe('getPlotPromise', () => {
    it('fetches single plot promise and processes ids', async () => {
      const mockPromise: PlotPromise = {
        id: 'plot_promises:gun1',
        project_id: 'projects:p1',
        kind: 'gun',
        title: 'Ружье',
        note: 'Заряжено',
        status: 'planted',
        milestones: [],
        location_id: null,
        timeline_event_id: null,
        m_abs: 100,
        calendar_id: null,
        participant_ids: [],
        arcs: [],
        arc_id: null,
        arc_phase: null,
      };
      vi.mocked(api.getPlotPromise).mockResolvedValueOnce(mockPromise as any);

      const res = await plotApi.getPlotPromise('plot_promises:gun1');

      expect(api.getPlotPromise).toHaveBeenCalledWith('plot_promises:gun1');
      expect(processIds).toHaveBeenCalledWith(mockPromise);
      expect(res).toEqual(mockPromise);
    });

    it('returns null when promise is not found', async () => {
      vi.mocked(api.getPlotPromise).mockResolvedValueOnce(null);

      const res = await plotApi.getPlotPromise('unknown');

      expect(res).toBeNull();
    });
  });

  describe('savePlotPromise', () => {
    it('normalizes project_id and saves plot promise', async () => {
      const input: PlotPromise = {
        id: 'plot_promises:gun1',
        project_id: null,
        kind: 'mystery',
        title: 'Загадочный сундук',
        note: null,
        status: 'planted',
        milestones: [],
        location_id: null,
        timeline_event_id: null,
        m_abs: null,
        calendar_id: null,
        participant_ids: ['entities:hero'],
        arcs: [],
        arc_id: null,
        arc_phase: null,
      };

      const saved: PlotPromise = {
        ...input,
        project_id: 'projects:my_book',
      };
      vi.mocked(api.savePlotPromise).mockResolvedValueOnce(saved as any);

      const res = await plotApi.savePlotPromise('my_book', input);

      expect(api.savePlotPromise).toHaveBeenCalledWith(
        'my_book',
        expect.objectContaining({
          project_id: 'projects:my_book',
          title: 'Загадочный сундук',
        })
      );
      expect(processIds).toHaveBeenCalledWith(saved);
      expect(res).toEqual(saved);
    });
  });

  describe('deletePlotPromise', () => {
    it('calls api.deletePlotPromise', async () => {
      vi.mocked(api.deletePlotPromise).mockResolvedValueOnce(undefined);

      await plotApi.deletePlotPromise('plot_promises:to_del');

      expect(api.deletePlotPromise).toHaveBeenCalledWith('plot_promises:to_del');
    });

    it('propagates error when delete fails', async () => {
      vi.mocked(api.deletePlotPromise).mockRejectedValueOnce(new Error('Delete error'));

      await expect(plotApi.deletePlotPromise('plot_promises:err')).rejects.toThrow('Delete error');
    });
  });

  describe('plantPlotPromise', () => {
    it('calls api.plantPlotPromise with promise', async () => {
      vi.mocked(api.plantPlotPromise).mockResolvedValueOnce(undefined);

      const promise = { id: 'p1', kind: 'gun', title: 'P' } as unknown as PlotPromise;
      await plotApi.plantPlotPromise(promise);

      expect(api.plantPlotPromise).toHaveBeenCalledWith(promise);
    });
  });

  describe('getStoryArcs', () => {
    it('fetches and filters story arcs with stripped project prefix', async () => {
      const mockArcs: StoryArc[] = [
        {
          id: 'story_arcs:arc1',
          project_id: 'projects:p1',
          title: 'Месть',
          description: null,
          arc_type: 'character',
          status: 'active',
          color: '#ff0000',
        },
      ];
      vi.mocked(api.getStoryArcs).mockResolvedValueOnce(mockArcs as any);

      const res = await plotApi.getStoryArcs('projects:novel');

      expect(api.getStoryArcs).toHaveBeenCalledWith('novel');
      expect(res).toEqual(mockArcs);
    });
  });

  describe('saveStoryArc', () => {
    it('calls api.saveStoryArc and returns arc id', async () => {
      vi.mocked(api.saveStoryArc).mockResolvedValueOnce('story_arcs:arc1');

      const arc: StoryArc = {
        id: null,
        project_id: 'projects:p1',
        title: 'Искупление',
        description: null,
        arc_type: 'theme',
        status: 'active',
        color: null,
      };

      const res = await plotApi.saveStoryArc(arc);

      expect(api.saveStoryArc).toHaveBeenCalledWith(arc);
      expect(res).toBe('story_arcs:arc1');
    });
  });
});
