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
import { isAbstractPlaceholder } from './useJourneyManuscriptEnricher';
import { resolveArcBindings } from './journeyArcBindings';

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
      // If an appearance is a scene that is already present in promises, skip to prevent duplicates
      if (app.source === 'scene') {
        const hasMatchingPromise = Array.isArray(data.promises) && data.promises.some(p => {
          const pChap = (p.chapter_id || '').split(':').pop() || '';
          const aChap = (app.chapter_id || '').split(':').pop() || '';
          if (pChap && aChap && pChap !== aChap) return false;
          return (p.paragraph_index && p.paragraph_index === app.paragraph_index) ||
                 (p.block_id && app.block_id && p.block_id === app.block_id);
        });
        if (hasMatchingPromise) return;
      }
      const isScene = (app.source as string) === 'scene';
      const appTitle = app.chapter_title ? `Глава «${app.chapter_title}»` : `Глава #${app.chapter_order ?? '?'}`;
      const appFullText = app.quote?.trim()
        || (app.role ? `Роль: ${app.role}` : (isScene ? `Сцена в ${appTitle}` : `Упоминание в тексте (${appTitle})`));

      const { boundArcs, allArcIds, primaryArc, combinedArcTitle } = resolveArcBindings(
        app.arcs,
        app.arc_id as string | undefined,
        app.arc_title as string | undefined,
        app.arc_color as string | undefined,
        app.arc_phase as string | undefined,
        storyArcs
      );

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
    });
  }

  // 1. Global Timeline Events (diegetic M_abs)
  if (Array.isArray(data.events)) {
    data.events.forEach((ev: JourneyEvent) => {
      const formattedDate = formatDiegeticDate(ev.m_abs, null, activeCal);
      const ageInfo = calculateDiegeticAge(birthMabs, ev.m_abs, activeCal);
      const eventQuote = ev.quote && !isAbstractPlaceholder(ev.quote) ? ev.quote : (ev.event_desc || `Событие «${ev.event_title}»`);
      const roleDescription = ev.role && ev.role !== 'Участник события' ? `Участие: ${ev.role}` : undefined;
      items.push({
        id: `ev-${ev.event_id}`,
        type: 'event',
        title: `Событие мира: ${ev.event_title}`,
        subtitle: formattedDate,
        fullText: eventQuote,
        timeLabel: formattedDate,
        phaseLabel: '⏳ Событие',
        m_abs: ev.m_abs,
        birth_m_abs: birthMabs,
        ageLabel: ageInfo?.ageLabel,
        isBeforeBirth: ageInfo?.isBeforeBirth,
        badge: 'Событие мира',
        badgeType: 'warning',
        description: ev.event_desc || roleDescription,
        chapter_id: ev.chapter_id,
        chapter_title: ev.chapter_title,
        chapter_order: ev.chapter_order,
        block_id: ev.block_id,
        paragraph_index: ev.paragraph_index,
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
    const { boundArcs, allArcIds, primaryArc, combinedArcTitle } = resolveArcBindings(
      p.arcs,
      p.arc_id,
      p.arc_title,
      p.arc_color,
      p.arc_phase,
      storyArcs
    );

    let computedMabs: number | undefined = p.m_abs ?? undefined;
    if (computedMabs === undefined && p.date_fields && typeof p.date_fields === 'object') {
      computedMabs = computeMabsFromDateFields(p.date_fields, activeCal) ?? undefined;
    }

    const formattedDate = formatDiegeticDate(computedMabs, p.date_fields, activeCal);
    const sceneKind = p.kind || 'scene';
    const ageInfo = calculateDiegeticAge(birthMabs, computedMabs, activeCal);
    const rawQuote = p.quote || (p as unknown as { title?: string }).title || 'Сюжетная сцена';
    const quoteSnippet = rawQuote.length > 45 ? `${rawQuote.slice(0, 45)}...` : rawQuote;

    let sceneParaIdx = p.paragraph_index;
    if ((sceneParaIdx === undefined || sceneParaIdx === null) && p.block_id) {
      const m = p.block_id.match(/para-(\d+)/);
      if (m) {
        sceneParaIdx = parseInt(m[1], 10);
      }
    }

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
      paragraph_index: sceneParaIdx,
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

