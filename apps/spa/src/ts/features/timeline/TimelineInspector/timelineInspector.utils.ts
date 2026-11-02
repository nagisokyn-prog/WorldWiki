import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarDate } from '@/services/Calendars/calendar.types';
import type {
  InspectorEvent,
  InspectorChapter,
  InspectorReveal,
  VisualizedConnectionLine,
  InspectorParticipant
} from './TimelineInspector.model';

export function normalizeId(id?: string | null): string {
  if (!id) return '';
  return String(id).replace(/^(chapters|plot_promises|timeline_events|entities):/, '');
}

export function getEventId(ev: InspectorEvent): string {
  return ev.event_id || ev.id || '';
}

export function checkIsFlashback(
  ev: InspectorEvent,
  allChs: InspectorChapter[],
  allEvents?: InspectorEvent[]
): boolean {
  if (ev.reveals?.some((r) => r.kind === 'flashback' || (r as unknown as { time_nature?: string }).time_nature === 'flashback')) {
    return true;
  }
  const rawObj = ev as unknown as { time_nature?: string; is_flashback?: boolean };
  if (rawObj.time_nature === 'flashback' || rawObj.is_flashback === true) {
    return true;
  }
  const text = `${ev.title} ${ev.description || ''}`.toLowerCase();
  if (text.includes('флешбэк') || text.includes('флешбек') || text.includes('ретроспектив') || text.includes('воспоминани')) {
    return true;
  }

  // Хронологический анахронизм: если сцена привязана к поздней главе, но её дата меньше дат ранних глав
  const primaryRev = ev.reveals?.[0];
  if (primaryRev && ev.m_abs > 0 && allChs.length > 1 && allEvents) {
    const cleanChId = normalizeId(primaryRev.chapter_id);
    const chIdx = allChs.findIndex((c) => normalizeId(c.id) === cleanChId);
    if (chIdx > 0) {
      const prevChIds = new Set(allChs.slice(0, chIdx).map((c) => normalizeId(c.id)));
      const prevEvents = allEvents.filter(
        (e) => e.m_abs > 0 && e.reveals?.some((r) => prevChIds.has(normalizeId(r.chapter_id)))
      );
      if (prevEvents.length > 0) {
        const maxPrevMabs = Math.max(...prevEvents.map((e) => e.m_abs));
        if (ev.m_abs < maxPrevMabs - 1440) {
          return true;
        }
      }
    }
  }
  return false;
}

export function formatEventDate(mAbs: number, cal: CalendarData | null): string {
  if (!cal || mAbs === undefined || mAbs === null) {
    return `M_abs: ${mAbs}`;
  }
  try {
    const dateInput = CalendarMath.getDateFromAbsolute(mAbs, cal);
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

export function cleanParticipantsList(rawParticipants?: Array<{ id?: string; name?: string; entity_type?: string } | string>): InspectorParticipant[] {
  if (!rawParticipants) return [];
  return rawParticipants
    .map((p) => {
      if (typeof p === 'string') {
        return { id: p, name: p.replace(/^entities:/, ''), entity_type: 'character' };
      }
      return {
        id: p.id || '',
        name: p.name || '',
        entity_type: p.entity_type || 'character',
      };
    })
    .filter((p) => Boolean(p && p.name && String(p.name).trim().length > 0));
}

export function calculateConnectionLines(params: {
  linkMode: 'focus' | 'all' | 'none';
  chapters: InspectorChapter[];
  events: InspectorEvent[];
  activeChapterId: string | null;
  hoveredChapterId: string | null;
  hoveredEventId: string | null;
  startX?: number;
  chapterSpacing?: number;
  eventSpacing?: number;
}): VisualizedConnectionLine[] {
  const {
    linkMode,
    chapters,
    events,
    activeChapterId,
    hoveredChapterId,
    hoveredEventId,
    startX = 60,
    chapterSpacing = 140,
    eventSpacing = 160
  } = params;

  if (linkMode === 'none' || !chapters.length || !events.length) return [];

  const lines: VisualizedConnectionLine[] = [];
  const chapterPositions = new Map<string, number>();
  chapters.forEach((ch, idx) => {
    chapterPositions.set(normalizeId(ch.id), startX + idx * chapterSpacing);
  });

  const eventPositions = new Map<string, number>();
  events.forEach((ev, idx) => {
    const evId = getEventId(ev) || `ev-${idx}`;
    eventPositions.set(evId, startX + idx * eventSpacing);
  });

  const targetChId = activeChapterId ? normalizeId(activeChapterId) : (hoveredChapterId ? normalizeId(hoveredChapterId) : null);
  const targetEvId = hoveredEventId ? getEventId({ id: hoveredEventId, title: '', m_abs: 0, reveals: [], participants: [] }) : null;

  events.forEach((ev) => {
    const evId = getEventId(ev);

    if (linkMode === 'focus') {
      if (targetChId) {
        const belongsToTargetCh = ev.reveals.some((r) => normalizeId(r.chapter_id) === targetChId);
        if (!belongsToTargetCh) return;
      } else if (targetEvId) {
        if (evId !== targetEvId) return;
      } else {
        return;
      }
    }

    ev.reveals.forEach((r: InspectorReveal) => {
      const cleanRChId = normalizeId(r.chapter_id);
      if (targetChId && cleanRChId !== targetChId) return;

      const x1 = chapterPositions.get(cleanRChId);
      const x2 = eventPositions.get(evId);

      if (x1 !== undefined && x2 !== undefined) {
        const isFlashback = checkIsFlashback(ev, chapters) || r.kind === 'flashback' || x1 > x2;
        lines.push({
          id: `line-${evId}-${r.chapter_id}`,
          eventId: evId,
          chapterId: r.chapter_id,
          eventTitle: ev.title,
          chapterTitle: r.chapter_title,
          chapterOrder: r.chapter_order ?? r.chapter_sort_order ?? 0,
          m_abs: ev.m_abs,
          kind: r.kind,
          isFlashback,
          x1,
          y1: 60,
          x2,
          y2: 170,
        });
      }
    });
  });

  return lines;
}
