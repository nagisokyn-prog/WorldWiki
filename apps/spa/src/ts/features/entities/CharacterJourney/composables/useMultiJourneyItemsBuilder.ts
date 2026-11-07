import type { StoryArc } from '@/types/generated/StoryArc';
import type {
  JourneyAppearance,
  JourneyFilterMode,
  JourneyTimelineItem,
  MultiJourneyResponse,
} from '../CharacterJourney.model';
import { getPhaseLabel } from './useJourneyItemsBuilder';

export function buildMultiJourneyTimelineItems(
  response: MultiJourneyResponse | null,
  storyArcs: StoryArc[],
  filterMode: JourneyFilterMode = 'union'
): JourneyTimelineItem[] {
  if (!response) return [];
  const items: JourneyTimelineItem[] = [];

  if (Array.isArray(response.scenes)) {
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
      const sceneQuote = scene.quote?.trim() || (scene.chapter_title
        ? `Совместная сцена в главе «${scene.chapter_title}» (${partNames})`
        : `Совместная сцена с участием: ${partNames}`);

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
        paragraph_index: scene.paragraph_index,
        block_id: scene.block_id,
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
  }

  // 2. Aggregate mentions/appearances when in 'union' mode (or mentions matching all entities in 'intersection')
  if (Array.isArray(response.appearances)) {
    const mentionsByPara = new Map<string, { app: JourneyAppearance; entityNames: string[] }>();

    for (const app of response.appearances) {
      if (app.source === 'scene') {
        const hasMatchingScene = Array.isArray(response.scenes) && response.scenes.some((s) => {
          const sChap = (s.chapter_id || '').split(':').pop() || '';
          const aChap = (app.chapter_id || '').split(':').pop() || '';
          if (sChap && aChap && sChap !== aChap) return false;
          return (s.paragraph_index && s.paragraph_index === app.paragraph_index) ||
                 (s.block_id && app.block_id && s.block_id === app.block_id);
        });
        if (hasMatchingScene) continue;
      }

      const chapId = (app.chapter_id || '').split(':').pop() || '';
      const paraIdx = app.paragraph_index || 0;
      const quoteSnippet = (app.quote || '').slice(0, 30).trim().toLowerCase();
      const key = `${chapId}_para_${paraIdx}_${quoteSnippet}`;
      const entName = (app as { entity_name?: string }).entity_name;

      if (mentionsByPara.has(key)) {
        if (entName && !mentionsByPara.get(key)!.entityNames.includes(entName)) {
          mentionsByPara.get(key)!.entityNames.push(entName);
        }
      } else {
        mentionsByPara.set(key, {
          app,
          entityNames: entName ? [entName] : [],
        });
      }
    }

    const selectedCount = Array.isArray(response.entities) ? response.entities.length : 2;

    for (const { app, entityNames } of mentionsByPara.values()) {
      if (filterMode === 'intersection' && entityNames.length < selectedCount) {
        continue;
      }

      const isScene = (app.source as string) === 'scene';
      const appTitle = app.chapter_title ? `Глава «${app.chapter_title}»` : `Глава #${app.chapter_order ?? '?'}`;
      const subtitle = entityNames.length > 0
        ? `${entityNames.join(' & ')} • ${isScene ? 'Сцена в главе' : 'Упоминание в рукописи'}`
        : (isScene ? 'Сцена в главе' : 'Упоминание в рукописи');
      const appFullText = app.quote?.trim()
        || (app.role ? `Роль: ${app.role}` : (isScene ? `Сцена в ${appTitle}` : `Упоминание в тексте (${appTitle})`));

      const boundArcs: Array<{
        arcId: string;
        arcTitle: string;
        arcColor?: string;
        phase: string;
        phaseLabel: string;
      }> = [];
      const allArcIds: string[] = [];

      if (Array.isArray(app.arcs) && app.arcs.length > 0) {
        app.arcs.forEach((rawEntry: unknown) => {
          if (!rawEntry) return;
          let entryArcId = '';
          let entryPhase = 'setup';

          if (typeof rawEntry === 'string') {
            entryArcId = rawEntry;
          } else if (typeof rawEntry === 'object' && rawEntry !== null) {
            const obj = rawEntry as { arc_id?: string; arc_phase?: string };
            entryArcId = obj.arc_id || '';
            entryPhase = obj.arc_phase || 'setup';
          }

          if (entryArcId) {
            const cleanId = entryArcId.replace(/^story_arcs:/, '');
            const arc = storyArcs.find((a) => (a.id || '').replace(/^story_arcs:/, '') === cleanId);
            const resolvedId = arc?.id || entryArcId;
            const resolvedTitle = arc?.title || 'Сюжетная арка';
            const resolvedColor = (arc as { color?: string })?.color || undefined;

            if (!allArcIds.includes(resolvedId)) {
              allArcIds.push(resolvedId);
            }

            boundArcs.push({
              arcId: resolvedId,
              arcTitle: resolvedTitle,
              arcColor: resolvedColor,
              phase: entryPhase,
              phaseLabel: getPhaseLabel(entryPhase),
            });
          }
        });
      }

      if (boundArcs.length === 0 && app.arc_id) {
        const cleanArcId = (app.arc_id as string).replace(/^story_arcs:/, '');
        const arc = storyArcs.find((a) => (a.id || '').replace(/^story_arcs:/, '') === cleanArcId);
        const resolvedId = arc?.id || (app.arc_id as string);
        const resolvedTitle = arc?.title || (app.arc_title as string) || 'Сюжетная арка';
        const resolvedColor = (arc as { color?: string })?.color || (app.arc_color as string) || undefined;
        const phase = (app.arc_phase as string) || 'setup';

        allArcIds.push(resolvedId);
        boundArcs.push({
          arcId: resolvedId,
          arcTitle: resolvedTitle,
          arcColor: resolvedColor,
          phase,
          phaseLabel: getPhaseLabel(phase),
        });
      }

      const primaryArc = boundArcs[0];
      const combinedArcTitle = boundArcs.length > 0
        ? boundArcs.map((b) => b.arcTitle).join(' & ')
        : (app.arc_title as string | undefined);

      items.push({
        id: `multi-app-${app.chapter_id}-${app.paragraph_index || app.created_at || Math.random()}`,
        type: 'appearance',
        kind: app.source || 'mention',
        title: app.chapter_title ? `Появление: ${app.chapter_title}` : `Глава #${app.chapter_order ?? '?'}`,
        subtitle,
        fullText: appFullText,
        description: app.chapter_title ? `Глава: «${app.chapter_title}»` : undefined,
        chapter_id: app.chapter_id,
        chapter_title: app.chapter_title,
        chapter_order: app.chapter_order,
        paragraph_index: app.paragraph_index,
        block_id: app.block_id,
        phaseLabel: '📖 Появление',
        badge: isScene ? 'Сцена' : 'Упоминание',
        badgeType: isScene ? 'accent' : 'accent',
        arc_id: primaryArc?.arcId,
        arc_title: combinedArcTitle,
        arc_color: primaryArc?.arcColor,
        arc_phase: primaryArc?.phase,
        boundArcs,
        allArcIds,
        m_abs: (app.m_abs as number | undefined),
      });
    }
  }

  return items;
}
