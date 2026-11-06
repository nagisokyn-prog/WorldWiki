import * as api from '@/services/api.client';
import type { useCalendarStore, CalendarRecord } from '@/stores/calendar.store';
import type { useStoryArcsStore } from '@/stores/story_arcs.store';
import type { ProjectEntityOption, TimelineEventOption } from './PromiseCardMeta.model';

export interface PromiseCardEntitiesResult {
  locations: ProjectEntityOption[];
  characters: ProjectEntityOption[];
  timelineEvents: TimelineEventOption[];
  calendars: CalendarRecord[];
}

export async function fetchPromiseCardEntities(
  project: string,
  calendarStore: ReturnType<typeof useCalendarStore>,
  arcsStore: ReturnType<typeof useStoryArcsStore>
): Promise<PromiseCardEntitiesResult> {
  const [locs, places, chars, timelineData, calList] = await Promise.all([
    api.getEntities(project, 'location').catch(() => []),
    api.getEntities(project, 'place').catch(() => []),
    api.getEntities(project, 'character').catch(() => []),
    api.getGlobalTimeline(project).catch(() => null),
    calendarStore.getCalendars(project).catch(() => []),
    arcsStore.loadArcs(project).catch(() => [])
  ]);

  const allLocs: ProjectEntityOption[] = [];
  const seenLocs = new Set<string>();

  const addLocList = (list: unknown[], type: string) => {
    if (Array.isArray(list)) {
      for (const item of list) {
        const ent = item as { id?: string; name?: string; title?: string };
        const id = ent.id || '';
        const name = ent.name || ent.title || id;
        if (id && !seenLocs.has(id)) {
          seenLocs.add(id);
          allLocs.push({ id, name, type });
        }
      }
    }
  };

  addLocList(locs, 'location');
  addLocList(places, 'place');

  let projectCharacters: ProjectEntityOption[] = [];
  if (Array.isArray(chars)) {
    projectCharacters = chars.map((c: unknown) => {
      const char = c as { id?: string; name?: string; title?: string };
      return {
        id: char.id || '',
        name: char.name || char.title || char.id || '',
        type: 'character'
      };
    }).filter(c => Boolean(c.id));
  }

  const eventsList: TimelineEventOption[] = [];
  const seenEventIds = new Set<string>();

  if (Array.isArray(timelineData)) {
    for (const ch of timelineData as Array<{ id?: string; title?: string; timeline_events?: Array<{ id?: string; title?: string; name?: string; m_abs?: number }> }>) {
      const chTitle = ch.title || (ch.id ? ch.id.replace(/^chapters:/, 'Глава ') : 'Глава');
      if (Array.isArray(ch.timeline_events)) {
        for (const ev of ch.timeline_events) {
          if (ev.id && !seenEventIds.has(ev.id)) {
            seenEventIds.add(ev.id);
            eventsList.push({
              id: ev.id,
              title: `[${chTitle}] ${ev.title || ev.name || ev.id}`,
              m_abs: ev.m_abs
            });
          }
        }
      }
    }
  } else if (timelineData && typeof timelineData === 'object') {
    const events = (timelineData as { events?: Array<{ id?: string; title?: string; name?: string; m_abs?: number }> }).events || [];
    if (Array.isArray(events)) {
      for (const ev of events) {
        if (ev.id && !seenEventIds.has(ev.id)) {
          seenEventIds.add(ev.id);
          eventsList.push({
            id: ev.id,
            title: ev.title || ev.name || ev.id || 'Событие',
            m_abs: ev.m_abs
          });
        }
      }
    }
  }

  return {
    locations: allLocs,
    characters: projectCharacters,
    timelineEvents: eventsList,
    calendars: calList || []
  };
}
