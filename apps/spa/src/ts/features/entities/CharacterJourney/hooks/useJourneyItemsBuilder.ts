import type { CalendarData } from '@/services/Calendars/calendar.types';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { StoryArc } from '@/types/generated/StoryArc';
import type {
  CharacterJourneyData,
  JourneyAppearance,
  JourneyTimelineItem,
  JourneyEvent,
  JourneyRelation,
  JourneyPromise,
} from '../CharacterJourney.model';
import { formatDiegeticDate, computeMabsFromDateFields, calculateDiegeticAge } from './useJourneyChronology';

export function getPhaseLabel(phase?: string | null): string {
  switch (phase) {
    case 'setup': return '🌱 Завязка';
    case 'escalation': return '⚡ Эскалация';
    case 'climax': return '🔥 Кульминация';
    case 'resolution': return '✅ Развязка';
    default: return '🌱 Сцена';
  }
}

export function extractBirthMabs(data: CharacterJourneyData | null, cal: CalendarData): number | null {
  if (!data) return null;
  const attrs = data.attributes || {};
  if (typeof attrs['birth_m_abs'] === 'number') {
    return attrs['birth_m_abs'];
  }
  const birthVal = attrs['дата_рождения'] ?? attrs['birth_date'];
  if (typeof birthVal === 'number') {
    return birthVal;
  }
  if (birthVal && typeof birthVal === 'object') {
    return computeMabsFromDateFields(birthVal as Record<string, unknown>, cal);
  }
  return null;
}

export function buildTimelineItems(
  data: CharacterJourneyData | null,
  storyArcs: StoryArc[],
  calendarData: CalendarData | null
): JourneyTimelineItem[] {
  if (!data) return [];
  const items: JourneyTimelineItem[] = [];
  const activeCal = calendarData || CalendarFormat.getDefaultCalendar();
  const birthMabs = extractBirthMabs(data, activeCal);

  // 0. Chapter / Scene Appearances
  if (Array.isArray(data.appearances)) {
    data.appearances.forEach((app: JourneyAppearance) => {
      const isScene = (app.source as string) === 'scene';
      const appTitle = app.chapter_title ? `Глава «${app.chapter_title}»` : `Глава #${app.chapter_order ?? '?'}`;
      const appFullText = app.role
        ? `Роль: ${app.role}`
        : (isScene ? `Сцена в ${appTitle}` : `Упоминание в тексте (${appTitle})`);
      items.push({
        id: `app-${app.chapter_id}-${app.source || 'mention'}-${app.created_at || Math.random()}`,
        type: 'appearance',
        kind: app.source || 'scene',
        title: app.chapter_title ? `Появление: ${app.chapter_title}` : `Глава #${app.chapter_order ?? '?'}`,
        subtitle: app.role ? `Роль: ${app.role}` : (isScene ? 'Сцена в главе' : 'Упоминание в рукописи'),
        fullText: appFullText,
        description: app.chapter_title ? `Глава: «${app.chapter_title}»` : undefined,
        chapter_id: app.chapter_id,
        chapter_title: app.chapter_title,
        chapter_order: app.chapter_order,
        phaseLabel: '📖 Появление',
        badge: isScene ? 'Сцена' : 'Упоминание',
        badgeType: 'accent',
      });
    });
  }

  // 1. Global Timeline Events (diegetic M_abs)
  if (Array.isArray(data.events)) {
    data.events.forEach((ev: JourneyEvent) => {
      const formattedDate = formatDiegeticDate(ev.m_abs, null, activeCal);
      const ageInfo = calculateDiegeticAge(birthMabs, ev.m_abs, activeCal);
      items.push({
        id: `ev-${ev.event_id}`,
        type: 'event',
        title: `Событие мира: ${ev.event_title}`,
        subtitle: formattedDate,
        fullText: ev.event_desc || ev.role || `Событие: ${ev.event_title}`,
        timeLabel: formattedDate,
        phaseLabel: '⏳ Событие',
        m_abs: ev.m_abs,
        birth_m_abs: birthMabs,
        ageLabel: ageInfo?.ageLabel,
        isBeforeBirth: ageInfo?.isBeforeBirth,
        badge: 'Событие мира',
        badgeType: 'warning',
        description: ev.event_desc || (ev.role ? `Участие: ${ev.role}` : undefined),
      });
    });
  }

  // 2. Relations
  if (Array.isArray(data.relations)) {
    data.relations.forEach((rel: JourneyRelation) => {
      items.push({
        id: `rel-${rel.id}`,
        type: 'relation_change',
        title: `Связь с «${rel.target_name}» (${rel.rel_type})`,
        subtitle: rel.start_order ? `С главы #${rel.start_order}` : 'С начала',
        fullText: `Отношение «${rel.rel_type}» с персонажем ${rel.target_name}`,
        phaseLabel: '👥 Связь',
        chapter_order: rel.start_order,
        badge: `Сила: ${rel.strength ?? 0}`,
        badgeType: (rel.strength ?? 0) >= 0 ? 'success' : 'danger',
      });
    });
  }

  // 3. Narrative Blocks (Plot Promises / Scenes) with multi-arc support
  if (Array.isArray(data.promises)) {
    data.promises.forEach((p: JourneyPromise) => {
    const boundArcs: Array<{
      arcId: string;
      arcTitle: string;
      arcColor?: string;
      phase: string;
      phaseLabel: string;
    }> = [];
    const allArcIds: string[] = [];

    if (Array.isArray(p.arcs) && p.arcs.length > 0) {
      p.arcs.forEach((rawEntry: unknown) => {
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
          const resolvedColor = arc?.color || undefined;

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

    if (boundArcs.length === 0 && p.arc_id) {
      const cleanArcId = p.arc_id.replace(/^story_arcs:/, '');
      const arc = storyArcs.find((a) => (a.id || '').replace(/^story_arcs:/, '') === cleanArcId);
      const resolvedId = arc?.id || p.arc_id;
      const resolvedTitle = arc?.title || p.arc_title || 'Сюжетная арка';
      const resolvedColor = arc?.color || p.arc_color || undefined;
      const phase = p.arc_phase || 'setup';

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
      : p.arc_title;

    let computedMabs = p.m_abs;
    if ((computedMabs === undefined || computedMabs === null) && p.date_fields && typeof p.date_fields === 'object') {
      computedMabs = computeMabsFromDateFields(p.date_fields, activeCal);
    }

    const formattedDate = formatDiegeticDate(computedMabs, p.date_fields, activeCal);
    const sceneKind = p.kind || 'scene';
    const ageInfo = calculateDiegeticAge(birthMabs, computedMabs, activeCal);
    const rawQuote = p.quote || (p as unknown as { title?: string }).title || 'Сюжетная сцена';
    const quoteSnippet = rawQuote.length > 45 ? `${rawQuote.slice(0, 45)}...` : rawQuote;

    items.push({
      id: `prom-${p.id}`,
      type: 'promise',
      kind: sceneKind,
      title: `${sceneKind === 'scene' ? 'Сцена' : 'Обещание'}: «${quoteSnippet}»`,
      subtitle: p.chapter_title
        ? `Глава: ${p.chapter_title}`
        : `Глава #${p.planted_order ?? '?'}`,
      fullText: rawQuote,
      timeLabel: formattedDate,
      phaseLabel: primaryArc?.phaseLabel || getPhaseLabel(p.arc_phase),
      chapter_id: p.chapter_id || undefined,
      chapter_title: p.chapter_title || undefined,
      chapter_order: p.planted_order,
      paragraph_index: p.paragraph_index,
      block_id: p.block_id || undefined,
      m_abs: computedMabs,
      birth_m_abs: birthMabs,
      ageLabel: ageInfo?.ageLabel,
      isBeforeBirth: ageInfo?.isBeforeBirth,
      calendar_id: p.calendar_id,
      date_fields: p.date_fields,
      timeline_event_id: p.timeline_event_id,
      arc_id: primaryArc?.arcId || p.arc_id || undefined,
      arc_title: combinedArcTitle,
      arc_color: primaryArc?.arcColor || p.arc_color || undefined,
      arc_phase: primaryArc?.phase || p.arc_phase || undefined,
      boundArcs,
      allArcIds,
      badge: p.status === 'resolved' ? 'Разрешено' : 'Активно',
      badgeType: p.status === 'resolved' ? 'success' : 'accent',
      description: primaryArc?.phase ? `Фаза арки: ${primaryArc.phase}` : undefined,
    });
  });
  }

  return items;
}

export { buildMultiJourneyTimelineItems } from './useMultiJourneyItemsBuilder';

