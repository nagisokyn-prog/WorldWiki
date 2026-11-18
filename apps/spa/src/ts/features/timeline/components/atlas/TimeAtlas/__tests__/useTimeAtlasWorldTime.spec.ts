import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTimeAtlasWorldTime } from '../useTimeAtlasWorldTime';
import * as api from '@/services/api.client';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn(),
}));

describe('useTimeAtlasWorldTime', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('merges calendar timezones with book locations and state capitals, and filters by mode', async () => {
    const capitalCity = {
      id: 'entities:loc_capital',
      entity_type: 'location',
      name: 'Авалон',
      attributes: {
        scale_level: 'settlement',
        широта: 51,
        долгота: 0,
        часовой_пояс: '+0',
      },
    };
    const eastPort = {
      id: 'entities:loc_port',
      entity_type: 'location',
      name: 'Восточная Гавань',
      attributes: {
        scale_level: 'settlement',
        широта: 35,
        долгота: 135,
        часовой_пояс: '+9',
      },
    };
    const kingdom = {
      id: 'entities:state_avalon',
      entity_type: 'state',
      name: 'Королевство Авалон',
      attributes: {
        столица: 'entities:loc_capital',
      },
    };

    vi.mocked(api.getEntities).mockImplementation(async (_proj, type) => {
      if (type === 'location') return [capitalCity, eastPort] as never;
      if (type === 'state') return [kingdom] as never;
      return [] as never;
    });

    const cal = CalendarEngine.getDefaultCalendar();
    cal.timezones = [
      { id: 'tz_utc', name: 'Гринвич', code: 'UTC', base_offset_hours: 0 },
      { id: 'tz_west', name: 'Западный пояс', code: 'UTC-5', base_offset_hours: -5 },
    ];

    const masterCal = computed(() => cal);
    const currentMin = ref(720); // 12:00 UTC

    const hook = useTimeAtlasWorldTime(
      masterCal,
      currentMin,
      (c) => CalendarEngine.getDateFromAbsolute(currentMin.value, c),
      'proj_world'
    );

    await hook.loadWorldGeographyEntities();

    // Режим 'all': Западный пояс (-5), Авалон (0), Восточная Гавань (+9)
    expect(hook.worldTimeSnapshot.value.length).toBe(3);
    expect(hook.worldTimeSnapshot.value.map((i) => i.region.name)).toEqual([
      'Западный пояс',
      'Авалон',
      'Восточная Гавань',
    ]);

    // Режим 'settlements': только локации книги (Авалон и Восточная Гавань)
    hook.worldSliceFilter.value = 'settlements';
    expect(hook.worldTimeSnapshot.value.map((i) => i.region.name)).toEqual([
      'Авалон',
      'Восточная Гавань',
    ]);

    // Режим 'capitals': только столицы государств (Авалон)
    hook.worldSliceFilter.value = 'capitals';
    expect(hook.worldTimeSnapshot.value.length).toBe(1);
    expect(hook.worldTimeSnapshot.value[0].region.name).toBe('Авалон');
    expect(hook.worldTimeSnapshot.value[0].isStateCapital).toBe(true);
    expect(hook.worldTimeSnapshot.value[0].stateName).toBe('Королевство Авалон');

    // Проверка открытия карточки сущности
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    hook.openLocationEntity('loc_capital');
    expect(dispatchSpy).toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });

  it('covers planet fallback timezones/regions, worldHour/worldMinute setters, snippet copy, and error handling', async () => {
    vi.useFakeTimers();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { useCalendarStore } = await import('@/stores/calendar.store');
    const calStore = useCalendarStore();

    vi.spyOn(calStore, 'getPlanets').mockReturnValue([
      {
        id: 'planets:p1',
        name: 'Терра',
        timezones: [{ id: 'tz_p1', name: 'Столичный', code: 'CAP', base_offset_hours: 2 }],
        regions: [{ id: 'reg_p1', name: 'Столица', timezone_id: 'tz_p1', latitude: 45, longitude: 30 }]
      } as never
    ]);

    vi.mocked(api.getEntities).mockRejectedValueOnce(new Error('geo err'));

    const cal = CalendarEngine.getDefaultCalendar();
    cal.planet_id = 'planets:p1';
    cal.timezones = [];
    cal.regions = [];
    const masterCal = computed(() => cal);
    const currentMin = ref(90); // 01:30
    const projRef = ref('proj_planet');

    const hook = useTimeAtlasWorldTime(
      masterCal,
      currentMin,
      (c) => CalendarEngine.getDateFromAbsolute(currentMin.value, c),
      projRef
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(hook.worldTimezones.value).toHaveLength(1);
    expect(hook.worldRegions.value).toHaveLength(1);
    expect(hook.masterCalendarName.value).toBeTruthy();
    expect(hook.maxHours.value).toBe(24);
    expect(hook.maxMinutes.value).toBe(60);

    // worldHour & worldMinute getters/setters with clamping
    expect(hook.worldHour.value).toBe(1);
    expect(hook.worldMinute.value).toBe(30);
    hook.worldHour.value = 30; // clamps to 23
    expect(hook.worldHour.value).toBe(23);
    hook.worldMinute.value = 99; // clamps to 59
    expect(hook.worldMinute.value).toBe(59);

    // Snippet & clipboard copy
    expect(hook.worldTimeSnippet.value).toContain('Столица');
    await hook.copyWorldTimeSnippet();
    expect(hook.isWorldTimeCopied.value).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(hook.isWorldTimeCopied.value).toBe(false);

    // Empty entityId guard
    hook.openLocationEntity('');

    errSpy.mockRestore();
    vi.useRealTimers();
  });

  it('covers missing masterCalendar, fallback planet fields, non-string projectId, and empty clipboard', async () => {
    const { useCalendarStore } = await import('@/stores/calendar.store');
    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'getPlanets').mockReturnValue([
      {
        id: 'planets:p_fallback',
        name: 'Плутон',
        timezones: [{ name: 'ТЗ1', offset_hours: -4 }],
        regions: [{ name: 'Рег1', timezone_code: 'ТЗ1', latitude: '12', longitude: '34', max_day_hours: '14', min_day_hours: '10' }],
      } as never,
    ]);
    vi.mocked(api.getEntities).mockResolvedValueOnce(null as never).mockResolvedValueOnce(null as never);

    const nullCal = computed(() => null);
    const currentMin = ref(0);
    const hookNull = useTimeAtlasWorldTime(nullCal, currentMin, () => null as never, ref(null as unknown as string));
    await Promise.resolve();
    expect(hookNull.worldTimeSnippet.value).toContain('не настроены географические регионы');
    expect(hookNull.masterCalendarName.value).toBe('Календарь Мира');
    await hookNull.copyWorldTimeSnippet();

    // Planet matched by name + time_settings fallback + dayMins = 0
    const calNoSettings = {
      ...CalendarEngine.getDefaultCalendar(),
      название: '',
      planet_id: 'Плутон',
      timezones: [],
      regions: [],
      настройки_времени: undefined,
      time_settings: { часов_в_сутках: 0, минут_в_часе: 0 },
    } as any;
    const hook2 = useTimeAtlasWorldTime(
      computed(() => calNoSettings),
      currentMin,
      () => null as never,
      ref('proj_2')
    );
    await Promise.resolve();
    expect(hook2.worldTimezones.value[0].id).toBe('tz_0');
    expect(hook2.worldTimezones.value[0].base_offset_hours).toBe(-4);
    expect(hook2.worldRegions.value[0].id).toBe('reg_0');
    expect(hook2.worldHour.value).toBe(0);
  });

  it('uses masterCalendar.default_timezone_id as the reference timezone for worldHour/worldMinute', async () => {
    vi.mocked(api.getEntities).mockResolvedValue([] as never);
    const cal = CalendarEngine.getDefaultCalendar();
    cal.default_timezone_id = 'tz_msk';
    cal.timezones = [
      { id: 'tz_ny', name: 'Нью-Йорк', code: 'UTC-5', base_offset_hours: -5 },
      { id: 'tz_lon', name: 'Лондон', code: 'UTC+0', base_offset_hours: 0 },
      { id: 'tz_msk', name: 'Москва', code: 'UTC+3', base_offset_hours: 3 },
    ];
    cal.regions = [
      { id: 'r_ny', name: 'Нью-Йорк', timezone_id: 'tz_ny', latitude: 40.71, longitude: -74 },
      { id: 'r_lon', name: 'Лондон', timezone_id: 'tz_lon', latitude: 51.5, longitude: -0.12 },
      { id: 'r_msk', name: 'Москва', timezone_id: 'tz_msk', latitude: 55.75, longitude: 37.61 },
    ];

    const currentMin = ref(0);
    const hook = useTimeAtlasWorldTime(
      computed(() => cal),
      currentMin,
      (c) => CalendarEngine.getDateFromAbsolute(currentMin.value, c),
      'proj_msk'
    );

    hook.worldHour.value = 6;
    hook.worldMinute.value = 0;

    // 06:00 в Москве (UTC+3) = 03:00 UTC+0 (180 минут)
    expect(currentMin.value).toBe(180);
    expect(hook.worldHour.value).toBe(6);
    expect(hook.worldMinute.value).toBe(0);

    const byName = Object.fromEntries(
      hook.worldTimeSnapshot.value.map((item) => [item.region.name, item.localTimeStr])
    );
    expect(byName['Москва']).toBe('06:00');
    expect(byName['Лондон']).toBe('03:00');
    expect(byName['Нью-Йорк']).toBe('22:00');
  });

  it('falls back to calendar_timezone string when default_timezone_id is absent', () => {
    const cal = {
      ...CalendarEngine.getDefaultCalendar(),
      calendar_timezone: 'UTC+3',
      timezones: [],
    } as any;
    const currentMin = ref(0);
    const hook = useTimeAtlasWorldTime(
      computed(() => cal),
      currentMin,
      (c) => CalendarEngine.getDateFromAbsolute(currentMin.value, c),
      'proj_cal_tz'
    );

    hook.worldHour.value = 1;
    hook.worldMinute.value = 0;
    // 01:00 (UTC+3) = 22:00 prev day UTC+0 (-120 min)
    expect(currentMin.value).toBe(-120);
    expect(hook.worldHour.value).toBe(1);
    expect(hook.worldMinute.value).toBe(0);
  });
});

