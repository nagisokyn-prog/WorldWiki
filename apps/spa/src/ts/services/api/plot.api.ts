/**
 * @file plot.api.ts
 * @description API-фасад для работы с сюжетными обещаниями (чеховскими ружьями), сценарными узлами и сюжетными арками
 */

import { processIds } from '@worldwiki/components';
import { projectRecordId } from './project.api';
import type { PlotPromise } from '../../types/generated/PlotPromise';
import type { StoryArc } from '../../types/generated/StoryArc';
import * as api from '../api.client';

export const plotApi = {
  getPlotPromises: async (project: string): Promise<PlotPromise[]> => {
    const rawProject = (project || '').replace(/^projects:/, '');
    const list = await api.getPlotPromises(rawProject);
    return (list as PlotPromise[])
      .map(processIds)
      .filter((p): p is PlotPromise => Boolean(p))
      .map((p) => ({
        ...p,
        arcs: Array.isArray(p.arcs) ? p.arcs : [],
        arc_id: typeof p.arc_id === 'string' ? p.arc_id : null,
        arc_phase: typeof p.arc_phase === 'string' ? p.arc_phase : null,
      }));
  },

  getPlotPromise: async (id: string): Promise<PlotPromise | null> => {
    const item = await api.getPlotPromise(id);
    if (!item) return null;
    const p = processIds<PlotPromise>(item as PlotPromise);
    return {
      ...p,
      arcs: Array.isArray(p.arcs) ? p.arcs : [],
      arc_id: typeof p.arc_id === 'string' ? p.arc_id : null,
      arc_phase: typeof p.arc_phase === 'string' ? p.arc_phase : null,
    };
  },

  savePlotPromise: async (project: string, data: PlotPromise): Promise<PlotPromise> => {
    const normalizedData: PlotPromise = {
      ...data,
      project_id: projectRecordId(project),
      arcs: Array.isArray(data.arcs) ? data.arcs : [],
      arc_id: typeof data.arc_id === 'string' ? data.arc_id : null,
      arc_phase: typeof data.arc_phase === 'string' ? data.arc_phase : null,
      time_nature: typeof data.time_nature === 'string' ? data.time_nature : null,
    };
    const rawProject = (project || '').replace(/^projects:/, '');
    const res = await api.savePlotPromise(rawProject, normalizedData);
    return processIds<PlotPromise>(res as PlotPromise);
  },

  deletePlotPromise: async (id: string): Promise<void> => {
    await api.deletePlotPromise(id);
  },

  plantPlotPromise: async (promise: PlotPromise): Promise<void> => {
    await api.plantPlotPromise(promise);
  },

  getStoryArcs: async (project: string): Promise<StoryArc[]> => {
    const rawProject = (project || '').replace(/^projects:/, '');
    const arcs = await api.getStoryArcs(rawProject);
    return (arcs || []).map(processIds).filter((a): a is StoryArc => Boolean(a));
  },

  saveStoryArc: async (arc: StoryArc): Promise<string> => {
    return await api.saveStoryArc(arc);
  },
};
