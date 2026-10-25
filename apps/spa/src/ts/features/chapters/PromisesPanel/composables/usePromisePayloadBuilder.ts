import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from './PromiseActions.model';

export function preparePromisePayload(
  item: RichPlotPromise,
  fallbackChapterId: string | null
): RichPlotPromise {
  const chapId = item.chapter_id || fallbackChapterId || null;
  const arcsArr = Array.isArray(item.arcs) && item.arcs.length > 0 ? item.arcs : [];
  const primaryArc = arcsArr.length > 0 ? arcsArr[0] : null;
  const derivedArcId = typeof item.arc_id === 'string' && item.arc_id
    ? item.arc_id
    : (primaryArc?.arc_id ? String(primaryArc.arc_id) : null);
  const derivedArcPhase = typeof item.arc_phase === 'string' && item.arc_phase
    ? item.arc_phase
    : (primaryArc?.arc_phase ? String(primaryArc.arc_phase) : (derivedArcId ? 'setup' : null));
  const finalArcs = arcsArr.length > 0
    ? arcsArr
    : (derivedArcId ? [{ arc_id: derivedArcId, arc_phase: derivedArcPhase || 'setup' }] : []);

  return {
    ...(item as unknown as PlotPromise),
    chapter_id: chapId || undefined,
    paragraph_index: item.paragraph_index ?? 1,
    block_id: item.block_id || null,
    arcs: finalArcs,
    arc_id: derivedArcId,
    arc_phase: derivedArcPhase,
  };
}

export function createNewPromiseRecord(
  project: string,
  chapterId: string | null,
  payload: {
    kind: string;
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
  }
): RichPlotPromise {
  return {
    id: `plot_promises:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    project_id: project,
    kind: payload.kind,
    title: payload.quote,
    note: null,
    status: 'planted',
    location_id: null,
    timeline_event_id: null,
    m_abs: null,
    calendar_id: null,
    participant_ids: [],
    arcs: [],
    arc_id: null,
    arc_phase: null,
    milestones: [
      {
        milestone_id: `ms_${Date.now()}`,
        stage: 'plant',
        quote: payload.quote,
        note: null,
        block_id: payload.block_id || '',
        chapter_id: chapterId || null,
        order_index: payload.paragraph_index
      }
    ],
    chapter_id: chapterId || undefined,
    quote: payload.quote,
    paragraph_index: payload.paragraph_index,
    block_id: payload.block_id || undefined,
    progressions: [],
    resolution: null,
    resolved_in_volume: null,
    resolved_in_chapter: null
  };
}
