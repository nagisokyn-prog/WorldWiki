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
});

