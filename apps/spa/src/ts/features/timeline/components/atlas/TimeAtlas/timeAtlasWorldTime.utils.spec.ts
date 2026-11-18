import { describe, it, expect } from 'vitest';
import { buildWorldTimeSnapshot } from './timeAtlasWorldTime.utils';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';

describe('timeAtlasWorldTime.utils', () => {
  const master = CalendarMath.getDefaultCalendar();
  const moment = { day_index: 10, day_tick: 720, planet_id: 'earth' };

  it('returns empty array when master is null', () => {
    expect(
      buildWorldTimeSnapshot({
        master: null,
        currentWorldMinute: 14400,
        moment,
        tzs: [],
        regions: [],
        projectEntities: [],
        filter: 'all',
      })
    ).toEqual([]);
  });

  it('builds snapshot across regions, location entities, and uncovered timezones with filters', () => {
    const tzs = [
      { id: 'tz_1', name: 'UTC+0', code: 'UTC+0', base_offset_hours: 0 },
      { id: 'tz_2', name: 'UTC+3', code: 'UTC+3', base_offset_hours: 3 },
      { id: 'tz_3', name: 'UTC-4', code: 'UTC-4', base_offset_hours: -4 },
    ];
    const regions = [
      { id: 'reg_1', name: 'Центр', timezone_id: 'tz_1', latitude: 40, longitude: 0 },
    ];
    const projectEntities = [
      {
        id: 'entities:cap1',
        name: 'Столица',
        entity_type: 'location',
        столица: false,
        масштаб: 'settlement',
        часовой_пояс: 'tz_2',
      },
    ];

    const all = buildWorldTimeSnapshot({
      master,
      currentWorldMinute: 14400,
      moment,
      tzs,
      regions,
      projectEntities,
      filter: 'all',
    });
    expect(all.some((i) => i.region.name === 'Центр')).toBe(true);
    expect(all.some((i) => i.region.name === 'Столица')).toBe(true);
    expect(all.some((i) => i.region.id === 'reg_auto_tz_3')).toBe(true);

    const settlements = buildWorldTimeSnapshot({
      master,
      currentWorldMinute: 14400,
      moment,
      tzs,
      regions,
      projectEntities,
      filter: 'settlements',
    });
    expect(settlements.every((i) => !i.region.id.startsWith('reg_auto_'))).toBe(true);

    const capitals = buildWorldTimeSnapshot({
      master,
      currentWorldMinute: 14400,
      moment,
      tzs,
      regions,
      projectEntities,
      filter: 'capitals',
    });
    expect(capitals.every((i) => Boolean(i.isStateCapital))).toBe(true);
  });
});
