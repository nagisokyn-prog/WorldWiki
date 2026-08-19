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
});
