import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from './PromiseActions.model';

function sanitizeBlockId(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const stripped = raw
    .replace(/^(text_blocks|blocks):/i, '')
    .replace(/[`⟨⟩"']/g, '')
    .trim();
  if (!stripped || stripped === 'NONE' || stripped === 'NULL') return '';
  const paraMatch = stripped.match(/(para-\d+)$/i);
  if (paraMatch) return paraMatch[1];
  return stripped.replace(/^blk_[^_]+_/, '');
}

function sanitizeParentId(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/^plot_promises:/i, '').replace(/[`⟨⟩"']/g, '').trim();
  if (!cleaned || cleaned === 'NONE' || cleaned === 'NULL') return null;
  return `plot_promises:${cleaned}`;
}

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

  const rawBlocks = item.block_ids && item.block_ids.length > 0
    ? item.block_ids
    : (item.block_id ? [item.block_id] : []);
  const cleanBlocks = rawBlocks
    .map((b) => sanitizeBlockId(b))
    .filter((b): b is string => b.length > 0);
  const cleanPrimaryBlock = sanitizeBlockId(item.block_id) || cleanBlocks[0] || null;

  return {
    ...(item as unknown as PlotPromise),
    parent_id: sanitizeParentId(item.parent_id),
    is_flashback: item.is_flashback ? true : false,
    chapter_id: chapId || undefined,
    paragraph_index: item.paragraph_index ?? 1,
    block_id: cleanPrimaryBlock,
    block_ids: cleanBlocks,
    arcs: finalArcs,
    arc_id: derivedArcId,
    arc_phase: derivedArcPhase,
    time_nature: item.time_nature || 'present',
    title: item.title?.trim() || item.quote?.trim() || 'Сюжетное обещание',
    quote: item.quote ?? '',
    kind: item.kind || 'gun',
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
    block_ids?: string[];
    parent_id?: string | null;
    location_id?: string | null;
    participant_ids?: string[];
    arcs?: RichPlotPromise['arcs'];
    time_nature?: string | null;
    m_abs?: number | null;
    calendar_id?: string | null;
  }
): RichPlotPromise {
  const quoteStr = payload.quote ? String(payload.quote).trim() : '';
  const titleStr = quoteStr || 'Сюжетное обещание';
  const kindStr = payload.kind || 'gun';

  return {
    id: `plot_promises:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    project_id: project,
    parent_id: payload.parent_id || null,
    kind: kindStr,
    title: titleStr,
    note: null,
    status: 'planted',
    time_nature: payload.time_nature || 'present',
    location_id: payload.location_id || null,
    timeline_event_id: null,
    m_abs: payload.m_abs ?? null,
    calendar_id: payload.calendar_id || null,
    participant_ids: payload.participant_ids ? [...payload.participant_ids] : [],
    arcs: payload.arcs ? [...payload.arcs] : [],
    arc_id: payload.arcs && payload.arcs[0]?.arc_id ? String(payload.arcs[0].arc_id) : null,
    arc_phase: payload.arcs && payload.arcs[0]?.arc_phase ? String(payload.arcs[0].arc_phase) : null,
    milestones: [
      {
        milestone_id: `ms_${Date.now()}`,
        stage: 'plant',
        quote: quoteStr,
        note: null,
        block_id: payload.block_id || '',
        chapter_id: chapterId || null,
        order_index: payload.paragraph_index
      }
    ],
    chapter_id: chapterId || undefined,
    quote: quoteStr,
    paragraph_index: payload.paragraph_index,
    block_id: payload.block_id || undefined,
    block_ids: payload.block_ids && payload.block_ids.length > 0 ? payload.block_ids : (payload.block_id ? [payload.block_id] : []),
    progressions: [],
    resolution: null,
    resolved_in_volume: null,
    resolved_in_chapter: null
  };
}

export function syncPromisesToLocalStorage(project: string, promises: RichPlotPromise[]): void {
  if (!project) return;
  try {
    localStorage.setItem(`ww_plot_promises_${project}`, JSON.stringify(promises));
  } catch (err) {
    console.warn('[usePromiseActions] Failed to backup promises to localStorage:', err);
  }
}
