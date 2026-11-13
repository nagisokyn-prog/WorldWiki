import type { StoryArc } from '@/types/generated/StoryArc';
import { getPhaseLabel } from './useJourneyItemsBuilder';

export interface BoundArcInfo {
  arcId: string;
  arcTitle: string;
  arcColor?: string;
  phase: string;
  phaseLabel: string;
}

export function resolveArcBindings(
  rawArcs: unknown,
  fallbackArcId: string | null | undefined,
  fallbackArcTitle: string | null | undefined,
  fallbackArcColor: string | null | undefined,
  fallbackArcPhase: string | null | undefined,
  storyArcs: StoryArc[]
): { boundArcs: BoundArcInfo[]; allArcIds: string[]; primaryArc?: BoundArcInfo; combinedArcTitle?: string } {
  const boundArcs: BoundArcInfo[] = [];
  const allArcIds: string[] = [];

  if (Array.isArray(rawArcs) && rawArcs.length > 0) {
    for (const rawEntry of rawArcs) {
      if (!rawEntry) continue;
      let entryArcId = '';
      let entryPhase = 'setup';
      if (typeof rawEntry === 'string') {
        entryArcId = rawEntry;
      } else if (typeof rawEntry === 'object') {
        const obj = rawEntry as { arc_id?: string; arc_phase?: string };
        entryArcId = obj.arc_id || '';
        entryPhase = obj.arc_phase || 'setup';
      }
      if (!entryArcId) continue;

      const cleanId = entryArcId.replace(/^story_arcs:/, '');
      const arc = storyArcs.find((a) => (a.id || '').replace(/^story_arcs:/, '') === cleanId);
      const resolvedId = arc?.id || entryArcId;
      if (!allArcIds.includes(resolvedId)) allArcIds.push(resolvedId);

      boundArcs.push({
        arcId: resolvedId,
        arcTitle: arc?.title || 'Сюжетная арка',
        arcColor: (arc as { color?: string })?.color || undefined,
        phase: entryPhase,
        phaseLabel: getPhaseLabel(entryPhase),
      });
    }
  }

  if (boundArcs.length === 0 && fallbackArcId) {
    const cleanArcId = fallbackArcId.replace(/^story_arcs:/, '');
    const arc = storyArcs.find((a) => (a.id || '').replace(/^story_arcs:/, '') === cleanArcId);
    const resolvedId = arc?.id || fallbackArcId;
    const phase = fallbackArcPhase || 'setup';
    allArcIds.push(resolvedId);
    boundArcs.push({
      arcId: resolvedId,
      arcTitle: arc?.title || fallbackArcTitle || 'Сюжетная арка',
      arcColor: (arc as { color?: string })?.color || fallbackArcColor || undefined,
      phase,
      phaseLabel: getPhaseLabel(phase),
    });
  }

  const primaryArc = boundArcs[0];
  const combinedArcTitle = boundArcs.length > 0
    ? boundArcs.map((b) => b.arcTitle).join(' & ')
    : (fallbackArcTitle ?? undefined);

  return { boundArcs, allArcIds, primaryArc, combinedArcTitle };
}

