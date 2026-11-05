import type { StoryArc } from '@/types/generated/StoryArc';
import type {
  JourneyTimelineItem,
  MultiJourneyResponse,
} from '../CharacterJourney.model';
import { getPhaseLabel } from './useJourneyItemsBuilder';

export function buildMultiJourneyTimelineItems(
  response: MultiJourneyResponse | null,
  storyArcs: StoryArc[]
): JourneyTimelineItem[] {
  if (!response || !response.scenes) return [];
  const items: JourneyTimelineItem[] = [];

  for (const scene of response.scenes) {
    const boundArcs: Array<{
      arcId: string;
      arcTitle: string;
      arcColor?: string;
      phase: string;
      phaseLabel: string;
    }> = [];
    const allArcIds: string[] = [];

    // Aggregate arcs across all present entities
    for (const part of scene.present_entities) {
      if (Array.isArray(part.arcs)) {
        for (const a of part.arcs) {
          if (!a.arc_id) continue;
          const cleanId = a.arc_id.replace(/^story_arcs:/, '');
          const matchArc = storyArcs.find((arc) => (arc.id || '').replace(/^story_arcs:/, '') === cleanId);
          const resolvedId = matchArc?.id || a.arc_id;
          const resolvedTitle = matchArc?.title || a.arc_title || 'Сюжетная арка';
          const resolvedColor = (matchArc as { color?: string })?.color || a.color || undefined;
          const phase = a.arc_phase || 'setup';

          if (!allArcIds.includes(resolvedId)) {
            allArcIds.push(resolvedId);
            boundArcs.push({
              arcId: resolvedId,
              arcTitle: resolvedTitle,
              arcColor: resolvedColor,
              phase,
              phaseLabel: getPhaseLabel(phase),
            });
          }
        }
      }
    }

    const primaryArc = boundArcs[0];
    const combinedArcTitle = boundArcs.length > 0
      ? boundArcs.map((b) => b.arcTitle).join(' & ')
      : undefined;

    const partCount = scene.present_entities.length;
    const partNames = scene.present_entities.map((p: { entity_name: string }) => p.entity_name).join(', ');
    const sceneQuote = scene.chapter_title
      ? `Совместная сцена в главе «${scene.chapter_title}» (${partNames})`
      : `Совместная сцена с участием: ${partNames}`;

    items.push({
      id: `scene-${scene.id}`,
      type: 'appearance',
      kind: scene.item_type || 'scene',
      title: scene.chapter_title ? `${scene.chapter_title}` : `Глава #${scene.sort_order}`,
      subtitle: scene.volume_title ? `${scene.volume_title} • ${partNames}` : partNames,
      fullText: sceneQuote,
      timeLabel: scene.scene_date_formatted || undefined,
      phaseLabel: primaryArc?.phaseLabel || '🌱 Сцена',
      chapter_id: scene.chapter_id || undefined,
      chapter_title: scene.chapter_title || undefined,
      chapter_order: scene.sort_order,
      m_abs: scene.scene_m_abs,
      arc_id: primaryArc?.arcId,
      arc_title: combinedArcTitle,
      arc_color: primaryArc?.arcColor,
      arc_phase: primaryArc?.phase,
      boundArcs,
      allArcIds,
      badge: `${partCount} перс.`,
      badgeType: partCount > 1 ? 'accent' : 'muted',
      description: scene.volume_title ? `Том: ${scene.volume_title}` : undefined,
      participants: scene.present_entities,
      meetingGap: scene.meeting_gap,
    });
  }

  return items;
}
