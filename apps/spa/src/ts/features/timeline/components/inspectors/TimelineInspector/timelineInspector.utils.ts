import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarDate } from '@/services/Calendars/calendar.types';
import {
  resolveLocationGeography,
  computeLocationLocalTime,
  getEntityName,
  type GeographyEntityRecord,
} from '@/services/Geography/locationHierarchy';
import {
  type InspectorEvent,
  type InspectorChapter,
  type InspectorParticipant,
  type FormattedInspectorEvent,
  type DateClusterColumn,
  type TimelineInspectorFilterState,
  getInspectorKindMeta,
} from './TimelineInspector.model';
import { calculateConnectionLines, calculateSceneHierarchyLines } from './timelineInspectorVolume.utils';

export { calculateConnectionLines, calculateSceneHierarchyLines };

export function normalizeId(id?: unknown): string {
  if (!id) return '';
  if (typeof id === 'object' && id !== null) {
    const obj = id as Record<string, unknown>;
    return normalizeId(obj.id || obj.String || '');
  }
  return String(id).replace(/^⟨|⟩$/g, '').replace(/^[a-zA-Z0-9_-]+:/, '').replace(/^⟨|⟩$/g, '').trim();
}

export function getEventId(ev: InspectorEvent): string {
  return ev.event_id || ev.id || '';
}

export function checkIsFlashback(
  ev: InspectorEvent,
  _allChs?: InspectorChapter[],
  _allEvents?: InspectorEvent[]
): boolean {
  if (ev.reveals?.some((r) => r.kind === 'flashback' || (r as unknown as { time_nature?: string }).time_nature === 'flashback')) {
    return true;
  }
  const rawObj = ev as unknown as { time_nature?: string; is_flashback?: boolean };
  return rawObj.time_nature === 'flashback' || rawObj.is_flashback === true;
}

export function resolveBestEraIndex(mAbs: number, cal: CalendarData): number {
  if (!cal.эпохи?.length) return 0;
  const isBCE = mAbs < 0;
  const baseIdx = Math.max(0, cal.эпохи.findIndex((e) => !e.обратный_отсчет === !isBCE));
  const rawDate = CalendarMath.getDateFromAbsolute(mAbs, cal, baseIdx);
  let bestIdx = baseIdx, maxStart = -Infinity;
  for (let i = 0; i < cal.эпохи.length; i++) {
    const era = cal.эпохи[i];
    if (!era.обратный_отсчет !== !isBCE) continue;
    const s = era.год_начала ?? 1, e = era.год_конца ?? Infinity;
    if (rawDate.year >= s && rawDate.year <= e && s > maxStart) {
      maxStart = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function formatEventDate(mAbs: number, cal: CalendarData | null): string {
  if (!cal || mAbs === undefined || mAbs === null) return `M_abs: ${mAbs}`;
  try {
    const bestEra = resolveBestEraIndex(mAbs, cal);
    const dateInput = CalendarMath.getDateFromAbsolute(mAbs, cal, bestEra);
    dateInput.era_index = bestEra;
    const calDate: CalendarDate = {
      absolute_minute: mAbs,
      calendar_id: (cal as unknown as { id?: string; _id?: string }).id || (cal as unknown as { id?: string; _id?: string })._id || 'default',
      original_input: dateInput,
    };
    return CalendarFormat.formatDate(cal, calDate) || `M_abs: ${mAbs}`;
  } catch {
    return `M_abs: ${mAbs}`;
  }
}

export function cleanParticipantsList(
  rawParticipants?: Array<{ id?: string; name?: string; entity_type?: string } | string>
): InspectorParticipant[] {
  if (!rawParticipants) return [];
  return rawParticipants
    .map((p) => {
      if (typeof p === 'string') return { id: p, name: p.replace(/^entities:/, ''), entity_type: 'character' };
      return { id: p.id || '', name: p.name || '', entity_type: p.entity_type || 'character' };
    })
    .filter((p) => Boolean(p && p.name && String(p.name).trim().length > 0));
}

export function buildFilteredChapters(
  rawChapters: InspectorChapter[],
  allEvents: InspectorEvent[],
  readerHorizonOrder: number | null
): InspectorChapter[] {
  let chs = [...rawChapters];
  if (readerHorizonOrder !== null) {
    chs = chs.filter((c, idx) => (c.sort_order && Number(c.sort_order) > 0 ? Number(c.sort_order) : idx + 1) <= (readerHorizonOrder ?? 999999));
  }

  return chs.map((ch, idx) => {
    const rawOrder = ch.sort_order ? Number(ch.sort_order) : 0;
    const order = rawOrder > 0 && rawOrder < 1000 ? rawOrder : idx + 1;
    const title = ch.title && ch.title.trim() ? ch.title.trim() : `Глава #${order}`;
    const cleanChId = normalizeId(ch.id);
    const chEvents = allEvents.filter((ev) => ev.reveals?.some((r) => normalizeId(r.chapter_id) === cleanChId));

    let flashbackCount = 0, earliestFlashbackEventId: string | null = null, minMabs = Infinity;
    chEvents.forEach((ev) => {
      if (checkIsFlashback(ev, chs, allEvents)) {
        flashbackCount++;
        if (ev.m_abs < minMabs) {
          minMabs = ev.m_abs;
          earliestFlashbackEventId = getEventId(ev);
        }
      }
    });

    return { ...ch, title, sort_order: order, sceneCount: chEvents.length, flashbackCount, earliestFlashbackEventId };
  });
}

export function filterInspectorEvents(
  rawEvents: InspectorEvent[],
  chaptersList: InspectorChapter[],
  filters: TimelineInspectorFilterState
): InspectorEvent[] {
  const q = filters.searchQuery.toLowerCase().trim();
  const isolatedChId = filters.isolatedChapterId ? normalizeId(filters.isolatedChapterId) : null;

  const evs = rawEvents.filter((ev: InspectorEvent) => {
    if (q && !ev.title.toLowerCase().includes(q) && !(ev.description || '').toLowerCase().includes(q)) return false;
    if (isolatedChId && !ev.reveals?.some((r) => normalizeId(r.chapter_id) === isolatedChId)) return false;
    if (filters.selectedEntityId !== 'all') {
      const target = normalizeId(filters.selectedEntityId);
      if (!ev.participants.some((p) => normalizeId(typeof p === 'string' ? p : p?.id) === target)) return false;
    }
    if (filters.selectedPovId !== 'all' && !ev.reveals.some((r) => r.pov_id === filters.selectedPovId)) return false;
    if (filters.showFlashbacksOnly && !checkIsFlashback(ev, chaptersList, rawEvents)) return false;
    if (filters.selectedVolumeId && filters.selectedVolumeId !== 'all' && ev.reveals?.length) {
      const allowedChIds = new Set(chaptersList.map((c) => normalizeId(c.id)));
      if (!ev.reveals.some((r) => allowedChIds.has(normalizeId(r.chapter_id)))) return false;
    }
    return true;
  });

  const sceneSignatures = new Set<string>();
  evs.forEach((ev) => {
    if (getEventId(ev).startsWith('plot_promises:') || !getEventId(ev).startsWith('timeline_events:')) {
      sceneSignatures.add(`${ev.m_abs}_${ev.title.trim().toLowerCase()}`);
    }
  });

  return evs
    .filter((ev) => !(getEventId(ev).startsWith('timeline_events:') && ev.kind === 'event' && sceneSignatures.has(`${ev.m_abs}_${ev.title.trim().toLowerCase()}`)))
    .sort((a, b) => a.m_abs - b.m_abs);
}

export function buildFormattedEvents(
  events: InspectorEvent[],
  chapters: InspectorChapter[],
  cal: CalendarData | null,
  rawAllEvents?: InspectorEvent[],
  projectEntities: GeographyEntityRecord[] = [],
  calendarsMap: Map<string, CalendarData> = new Map()
): FormattedInspectorEvent[] {
  const entitiesById = new Map<string, GeographyEntityRecord>();
  const entitiesByName = new Map<string, GeographyEntityRecord>();
  for (const ent of projectEntities) {
    const cid = normalizeId(ent.id);
    if (cid) entitiesById.set(cid, ent);
    const name = getEntityName(ent);
    if (name) entitiesByName.set(name.toLowerCase(), ent);
  }

  return events.map((ev) => {
    const evId = getEventId(ev);
    const cleanParticipants = cleanParticipantsList(ev.participants);
    const kind = ev.kind || (evId.startsWith('timeline_events:') ? 'event' : 'scene');
    const kindMeta = getInspectorKindMeta(kind);
    const isFlashback = checkIsFlashback(ev, chapters, rawAllEvents);
    const primaryReveal = ev.reveals?.[0];

    let targetCal: CalendarData | null = cal;
    const evCalId = ev.calendar_id || (ev as unknown as { calendar?: string }).calendar;
    if (evCalId && evCalId !== 'default') {
      const cleanCal = normalizeId(evCalId);
      targetCal = calendarsMap.get(cleanCal) || calendarsMap.get(String(evCalId)) || calendarsMap.get(String(evCalId).toLowerCase()) || cal;
    }

    let locationName: string | undefined, localTimeBadge: string | undefined, localTimeHint: string | null = null;
    let hasTimezoneDiscrepancy = false;

    if (ev.location_id) {
      const cleanLocId = normalizeId(ev.location_id);
      const matchedLoc = entitiesById.get(cleanLocId) || entitiesByName.get(cleanLocId.toLowerCase());
      locationName = matchedLoc ? getEntityName(matchedLoc) || cleanLocId : cleanLocId;

      if (matchedLoc && ev.m_abs !== undefined && ev.m_abs !== null) {
        const geo = resolveLocationGeography(matchedLoc, projectEntities, (targetCal || cal)?.timezones || []);
        if ((!evCalId || evCalId === 'default') && geo.officialCalendarId) {
          targetCal = calendarsMap.get(normalizeId(geo.officialCalendarId)) || calendarsMap.get(String(geo.officialCalendarId).toLowerCase()) || targetCal;
        }
        const timeInfo = computeLocationLocalTime(ev.m_abs, geo, targetCal, targetCal?.timezones || cal?.timezones || [], true);
        localTimeBadge = `${timeInfo.phaseEmoji} ${timeInfo.localTimeStr}`;
        hasTimezoneDiscrepancy = timeInfo.hasDiscrepancy;
        localTimeHint = timeInfo.discrepancyHint || `Местное время в «${geo.entityName}»: ${timeInfo.localTimeStr} (${timeInfo.sunStatus.phase_label})`;
      }
    }

    const formattedDate = formatEventDate(ev.m_abs, targetCal);
    const isUndated = ev.m_abs === 0;
    let dayKey = 'undated';
    let dayLabel = 'Без даты';
    let timeLabel = '';

    if (!isUndated && targetCal) {
      try {
        const bestEra = resolveBestEraIndex(ev.m_abs, targetCal);
        const parts = CalendarMath.getDateFromAbsolute(ev.m_abs, targetCal, bestEra);
        const monthName = targetCal.месяцы?.[parts.month]?.название || `Мес. ${parts.month + 1}`;
        dayKey = `${bestEra}_${parts.year}_${parts.month}_${parts.day}`;
        dayLabel = `${parts.day} ${monthName} ${parts.year}`;
        const hh = String(parts.hour ?? 0).padStart(2, '0');
        const mm = String(parts.minute ?? 0).padStart(2, '0');
        if (parts.hour || parts.minute) timeLabel = `${hh}:${mm}`;
      } catch {
        dayKey = `m_${ev.m_abs}`;
        dayLabel = formattedDate;
      }
    } else if (!isUndated) {
      dayKey = `m_${ev.m_abs}`;
      dayLabel = formattedDate;
    }

    const chObj = primaryReveal?.chapter_id
      ? chapters.find((c) => normalizeId(c.id) === normalizeId(primaryReveal.chapter_id))
      : undefined;

    const rawParent = ev.parent_id ? normalizeId(ev.parent_id) : '';
    const parentIdNormalized = rawParent && rawParent.toUpperCase() !== 'NONE' ? rawParent : undefined;

    return {
      ...ev,
      id: evId,
      formattedDate,
      dayKey,
      dayLabel,
      timeLabel,
      isUndated,
      cleanParticipants,
      isScene: evId.startsWith('plot_promises:') || !evId.startsWith('timeline_events:'),
      kind,
      kindMeta,
      isFlashback,
      primaryChapterId: primaryReveal?.chapter_id ? normalizeId(primaryReveal.chapter_id) : undefined,
      primaryChapterTitle: primaryReveal?.chapter_title || chObj?.title || undefined,
      primaryChapterOrder: chObj?.sort_order ?? primaryReveal?.chapter_order ?? primaryReveal?.chapter_sort_order,
      locationName,
      localTimeBadge,
      localTimeHint,
      hasTimezoneDiscrepancy,
      parentIdNormalized,
    };
  });
}

export function groupEventsByDate(events: FormattedInspectorEvent[]): DateClusterColumn[] {
  const cloned = events.map((ev) => ({
    ...ev,
    sameDayChildren: [] as FormattedInspectorEvent[],
    crossDayChildCount: 0,
  }));

  const byId = new Map<string, FormattedInspectorEvent>();
  for (const ev of cloned) {
    byId.set(normalizeId(ev.id), ev);
  }

  const topLevelEvents: FormattedInspectorEvent[] = [];
  for (const ev of cloned) {
    const parentKey = ev.parentIdNormalized || (ev.parent_id ? normalizeId(ev.parent_id) : '');
    const parent = parentKey && parentKey.toUpperCase() !== 'NONE' ? byId.get(parentKey) : undefined;

    if (parent && normalizeId(parent.id) !== normalizeId(ev.id)) {
      ev.parentIdNormalized = normalizeId(parent.id);
      ev.parentTitle = parent.title;
      if (parent.dayKey === ev.dayKey) {
        parent.sameDayChildren = parent.sameDayChildren || [];
        parent.sameDayChildren.push(ev);
        continue;
      }
      parent.crossDayChildCount = (parent.crossDayChildCount || 0) + 1;
    }
    topLevelEvents.push(ev);
  }

  const columns: DateClusterColumn[] = [];
  const map = new Map<string, DateClusterColumn>();
  for (const ev of topLevelEvents) {
    let col = map.get(ev.dayKey);
    if (!col) {
      col = {
        key: ev.dayKey,
        label: ev.dayLabel,
        isUndated: Boolean(ev.isUndated),
        events: [],
      };
      map.set(ev.dayKey, col);
      columns.push(col);
    }
    col.events.push(ev);
  }
  return columns;
}
