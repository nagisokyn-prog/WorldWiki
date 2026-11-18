import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calendarApi } from '../calendar.api';
import { invoke } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn(),
}));

describe('calendarApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCalendars calls invoke get_calendars', async () => {
    const mockCalendars = [{ id: 'cal1', name: 'Gregorian' }];
    vi.mocked(invoke).mockResolvedValueOnce(mockCalendars);

    const res = await calendarApi.getCalendars('test-proj');

    expect(invoke).toHaveBeenCalledWith('get_calendars', { project: 'test-proj' });
    expect(res).toEqual(mockCalendars);
  });

  it('saveCalendar formats data and strips id, _id, is_default, is_master', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ success: true });

    const inputData = {
      id: 'cal_123',
      _id: 'cal_123',
      название: 'Календарь Империи',
      is_default: true,
      is_master: false,
      months: ['Jan', 'Feb'],
    };

    const res = await calendarApi.saveCalendar('test-proj', inputData);

    expect(invoke).toHaveBeenCalledWith('save_calendar', {
      data: {
        id: 'cal_123',
        project_id: 'projects:test-proj',
        name: 'Календарь Империи',
        is_default: true,
        is_master: false,
        data: {
          название: 'Календарь Империи',
          months: ['Jan', 'Feb'],
        },
      },
    });
    expect(res).toEqual({ success: true });
  });

  it('saveCalendar handles missing id and title fallback', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ success: true });

    const inputData = {
      daysInWeek: 7,
    };

    await calendarApi.saveCalendar('projects:test-proj', inputData);

    expect(invoke).toHaveBeenCalledWith('save_calendar', {
      data: {
        id: null,
        project_id: 'projects:test-proj',
        name: 'Новый календарь',
        is_default: false,
        is_master: false,
        data: {
          daysInWeek: 7,
        },
      },
    });
  });

  it('deleteCalendar invokes delete_calendar', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await calendarApi.deleteCalendar('cal_123');

    expect(invoke).toHaveBeenCalledWith('delete_calendar', { id: 'cal_123' });
  });

  it('getGlobalTimeline invokes get_global_timeline', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ events: [] });

    const res = await calendarApi.getGlobalTimeline('proj-1');

    expect(invoke).toHaveBeenCalledWith('get_global_timeline', { project: 'proj-1' });
    expect(res).toEqual({ events: [] });
  });

  it('saveGlobalTimeline invokes save_global_timeline', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ success: true });

    const res = await calendarApi.saveGlobalTimeline('proj-1', { timeline: true });

    expect(invoke).toHaveBeenCalledWith('save_global_timeline', { project: 'proj-1', data: { timeline: true } });
    expect(res).toEqual({ success: true });
  });

  it('covers planet/calendar direct commands and planet_id branch in saveCalendar', async () => {
    vi.mocked(invoke).mockResolvedValue({ ok: true });

    await calendarApi.saveCalendar('proj-1', {
      planet_id: 'earth',
      data: { название: 'Test', _id: 'strip' },
    });
    expect(invoke).toHaveBeenCalledWith(
      'save_calendar',
      expect.objectContaining({
        data: expect.objectContaining({ planet_id: 'earth', name: 'Test' }),
      })
    );

    await calendarApi.getPlanetCalendarBundle('proj-1');
    expect(invoke).toHaveBeenCalledWith('get_planet_calendar_bundle', { project: 'proj-1' });

    await calendarApi.savePlanetDirect('proj-1', 'p1', 'Earth', {
      moons: [{ name: 'Luna', color: '#fff' }, 'raw'],
      timezones: [{ id: 'tz1' }],
      regions: [{ id: 'reg1' }],
    });
    expect(invoke).toHaveBeenCalledWith('save_planet', {
      params: expect.objectContaining({
        project: 'proj-1',
        planet_id: 'p1',
        name: 'Earth',
        moons: [{ name: 'Luna' }, 'raw'],
      }),
    });

    await calendarApi.savePlanetDirect('proj-1', null, 'Mars', {});
    expect(invoke).toHaveBeenCalledWith('save_planet', {
      params: expect.objectContaining({ planet_id: null, moons: null, timezones: [], regions: [] }),
    });

    await calendarApi.saveCalendarDirect('proj-1', null, null, 'Cal', true, { a: 1 });
    expect(invoke).toHaveBeenCalledWith('save_calendar_direct', {
      project: 'proj-1',
      calendarId: null,
      planetId: 'earth',
      name: 'Cal',
      isMaster: true,
      data: { a: 1 },
    });

    await calendarApi.setMasterCalendar('proj-1', 'p1', 'c1');
    expect(invoke).toHaveBeenCalledWith('set_master_calendar', {
      project: 'proj-1',
      planetId: 'p1',
      calendarId: 'c1',
    });

    await calendarApi.deletePlanetDirect('proj-1', 'p1');
    expect(invoke).toHaveBeenCalledWith('delete_planet', {
      project: 'proj-1',
      planetId: 'p1',
      cascade: true,
    });

    await calendarApi.deletePlanetDirect('proj-1', 'p1', false);
    expect(invoke).toHaveBeenCalledWith('delete_planet', {
      project: 'proj-1',
      planetId: 'p1',
      cascade: false,
    });

    await calendarApi.deleteCalendarDirect('c1');
    expect(invoke).toHaveBeenCalledWith('delete_calendar_direct', { calendarId: 'c1' });
  });
});
