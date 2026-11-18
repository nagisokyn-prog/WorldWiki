import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useLocationAstronomyWidget } from '../useLocationAstronomyWidget';
import * as api from '@/services/api.client';
import { useCalendarStore } from '@/stores/calendar.store';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn(),
}));

describe('useLocationAstronomyWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads locations and states, resolves inherited coordinates, and formats local astronomy', async () => {
    const mockParentCity = {
      id: 'entities:city_1',
      entity_type: 'location',
      name: 'Вестгард',
      attributes: {
        scale_level: 'settlement',
        широта: 45,
        долгота: 60,
        часовой_пояс: '+4',
      },
    };
    const mockState = {
      id: 'entities:state_1',
      entity_type: 'state',
      name: 'Королевство Вестгард',
      attributes: {
        столица: 'entities:city_1',
      },
    };

    vi.mocked(api.getEntities).mockImplementation(async (_proj, type) => {
      if (type === 'location') return [mockParentCity] as never;
      if (type === 'state') return [mockState] as never;
      return [] as never;
    });

    const calStore = useCalendarStore();
    const defaultCal = CalendarEngine.getDefaultCalendar();
    defaultCal.timezones = [
      { id: 'tz_westgard', name: 'Вестгардское время', code: 'UTC+4', base_offset_hours: 4 },
    ];
    vi.spyOn(calStore, 'getCalendars').mockResolvedValue([
      { id: 'cal_1', is_master: true, data: defaultCal } as never,
    ]);

    const props = reactive({
      project: 'proj_test',
      entityId: 'entities:bar_1',
      formData: {
        название: 'Таверна «Ржавый Якорь»',
        scale_level: 'building',
        тип_заведения: 'hospitality',
        родительская_локация: 'entities:city_1',
      },
    });

    const emit = vi.fn();
    const hook = useLocationAstronomyWidget(props, emit);
    await hook.refreshContext();

    expect(hook.isLoading.value).toBe(false);
    expect(hook.loadError.value).toBeNull();
    expect(hook.resolvedGeo.value.isInherited).toBe(true);
    expect(hook.resolvedGeo.value.inheritedFromName).toBe('Вестгард');
    expect(hook.resolvedGeo.value.offsetHours).toBe(4);
    expect(hook.formattedOffset.value).toBe('UTC+4');
    expect(hook.coordinatesLabel.value).toContain('45° с.ш.');
    expect(hook.timeInfo.value.localTimeStr).toBe('16:00');

    hook.selectTimezonePreset('UTC+4');
    expect(emit).toHaveBeenCalledWith('apply-timezone', 'UTC+4');

    hook.setSeasonDayPreset(355);
    expect(hook.previewDayIndex.value).toBe(355);
  });

  it('handles API errors gracefully without swallowing them', async () => {
    vi.mocked(api.getEntities).mockRejectedValue(new Error('DB connection lost'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const props = reactive({
      project: 'proj_err',
      entityId: 'entities:loc_err',
      formData: { название: 'Ошибочная локация' },
    });

    const hook = useLocationAstronomyWidget(props);
    await hook.refreshContext();

    expect(hook.isLoading.value).toBe(false);
    expect(hook.loadError.value).toBe('DB connection lost');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('covers locationAstronomyWidget.utils formatting and season calculation', async () => {
    const {
      formatTimezoneChipLabel,
      formatCoordinatesLabel,
      computeAvailableSeasons,
    } = await import('../locationAstronomyWidget.utils');

    expect(formatTimezoneChipLabel({ id: 'tz1', name: 'UTC+3', base_offset_hours: 3 })).toBe('UTC+3');
    expect(formatTimezoneChipLabel({ id: 'tz2', name: 'Столичный', base_offset_hours: 3 })).toBe('Столичный (UTC+3)');
    expect(formatTimezoneChipLabel({ id: 'tz3', name: 'Западный', base_offset_hours: -5 })).toBe('Западный (UTC-5)');

    expect(formatCoordinatesLabel(null, null)).toBe('');
    expect(formatCoordinatesLabel(55.7, 37.6)).toBe('55.7° с.ш., 37.6° в.д.');
    expect(formatCoordinatesLabel(-12, -45)).toBe('12° ю.ш., 45° з.д.');
    expect(formatCoordinatesLabel(10, null)).toBe('10° с.ш.');

    expect(computeAvailableSeasons(null, null)).toEqual([]);
    const seasons = computeAvailableSeasons(
      {
        месяцы: [{ название: 'М1', дней: 30 }, { название: 'М2', дней: 31 }],
        сезоны: [{ название: 'Лето', месяцы: [1] }],
      } as never,
      null
    );
    expect(seasons).toEqual([{ name: 'Лето', startDay: 30 }]);
  });

  it('covers planet timezone fallback, negative offset, building without subtype, and project watcher', async () => {
    vi.mocked(api.getEntities).mockResolvedValue([] as never);
    const calStore = useCalendarStore();
    const cal = CalendarEngine.getDefaultCalendar();
    cal.timezones = [];
    cal.planet_id = 'planet_1';
    vi.spyOn(calStore, 'getCalendars').mockResolvedValue([
      { id: 'cal_def', name: 'DefaultCal', is_default: true, data: cal } as never,
    ]);
    vi.spyOn(calStore, 'getPlanets').mockReturnValue([
      {
        id: 'planet_1',
        name: 'Terra',
        timezones: [{ id: 'tz_west', name: 'West', code: 'UTC-5', base_offset_hours: -5 }],
      } as never,
    ]);

    const props = reactive({
      project: '',
      entityId: '',
      formData: {
        scale_level: 'unknown_scale',
        часовой_пояс: '-5',
        календарь_id: 'cal_def',
      },
    });

    const hook = useLocationAstronomyWidget(props);
    await hook.refreshContext(); // empty project -> early return
    expect(api.getEntities).not.toHaveBeenCalled();

    props.project = 'proj_2';
    await hook.refreshContext();

    expect(hook.availableTimezones.value.length).toBe(1);
    expect(hook.formattedOffset.value).toBe('UTC-5');
    expect(hook.scaleLabel.value).toBeTruthy();

    props.formData.scale_level = 'building';
    expect(hook.scaleLabel.value).toBeTruthy();

    for (const s of ['interior', 'district', 'settlement', 'region', 'macro']) {
      props.formData.scale_level = s;
      expect(hook.scaleLabel.value).toBeTruthy();
    }
    props.formData.часовой_пояс = 'UTC+3';
    expect(hook.formattedOffset.value).toBe('UTC+3');
    props.formData.часовой_пояс = 'invalid';
    expect(hook.formattedOffset.value).toBeTruthy();
  });
});

