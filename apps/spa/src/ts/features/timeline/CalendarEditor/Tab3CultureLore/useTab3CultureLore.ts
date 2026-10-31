import { computed, ref, watch } from 'vue';
import { useCalendarStore } from '@/stores/calendar.store';
import type {
  Tab3CultureLoreProps,
  Tab3CultureLoreEmits,
  CultureSeasonDto,
  CultureHolidayDto,
  CharacterAgeRuleDto,
} from './Tab3CultureLore.model';
import type { CalendarData, CalendarMonth, MoonPhaseNames } from '@/services/Calendars/calendar.types';

export function useTab3CultureLore(
  props: Tab3CultureLoreProps,
  emit: Tab3CultureLoreEmits
) {
  const calendarStore = useCalendarStore();

  const months = computed<CalendarMonth[]>(() => {
    return props.calendarData?.месяцы || [];
  });

  const seasons = computed<CultureSeasonDto[]>(() => {
    const raw = props.calendarData?.сезоны;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as CultureSeasonDto[];
    }
    return [
      { название: '❄️ Зима', цвет: 'var(--accent-primary)', hemisphere: 'northern', месяцы: [0, 1, 11] },
      { название: '🌸 Весна', цвет: 'var(--accent-success)', hemisphere: 'northern', месяцы: [2, 3, 4] },
      { название: '☀️ Лето', цвет: 'var(--accent-warning)', hemisphere: 'northern', месяцы: [5, 6, 7] },
      { название: '🍂 Осень', цвет: 'var(--accent-danger)', hemisphere: 'northern', месяцы: [8, 9, 10] },
    ];
  });

  const holidays = computed<CultureHolidayDto[]>(() => {
    const raw = props.calendarData?.праздники;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as CultureHolidayDto[];
    }
    return [
      {
        название: 'Новый Год',
        дата_начала: { месяц: 0, день: 1 },
        is_range: false,
      },
      {
        название: 'Сатурналии / Зимние Празднества',
        дата_начала: { месяц: 11, день: 17 },
        дата_конца: { месяц: 11, день: 23 },
        is_range: true,
      },
    ];
  });

  const phaseNames = ref<MoonPhaseNames>({
    new: 'Новолуние (Рождение Месяца)',
    waxing: 'Молодик (Растущий Серп)',
    full: 'Полнолуние (Круглая Луна)',
    waning: 'Ущерб (Стареющий Месяц)',
  });

  function syncMoonPhaseNames() {
    const fromMoon = props.calendarData?.moons?.[0]?.phase_names;
    const fromCal = (props.calendarData as Record<string, unknown>)?.moon_phase_names as MoonPhaseNames | undefined;
    const names = fromMoon || fromCal;
    if (names) {
      phaseNames.value = { ...names };
    }
  }

  syncMoonPhaseNames();
  watch(
    () => [props.calendarData?.moons?.[0]?.phase_names, (props.calendarData as Record<string, unknown>)?.moon_phase_names],
    syncMoonPhaseNames
  );

  const ageRule = computed<CharacterAgeRuleDto>(() => {
    const raw = props.calendarData?.character_age_rules as unknown as CharacterAgeRuleDto | undefined;
    if (raw && typeof raw === 'object') {
      return {
        age_at_birth: raw.age_at_birth ?? 0,
        step_on_new_year: Boolean(raw.step_on_new_year),
        year_only: Boolean(raw.year_only),
      };
    }
    return {
      age_at_birth: 0,
      step_on_new_year: false,
      year_only: false,
    };
  });

  const regionsList = computed<{ id: string; name: string }[]>(() => {
    const projId = (props.calendarData as Record<string, unknown>)?.project_id as string | undefined;
    const planets = calendarStore.getPlanets(projId || 'default');
    const activePlanet = planets[0];
    if (activePlanet && Array.isArray(activePlanet.regions) && activePlanet.regions.length > 0) {
      return activePlanet.regions.map((r, i) => ({
        id: (r as { id?: string }).id || `reg_${i}`,
        name: r.name || `Регион ${i + 1}`
      }));
    }
    return [
      { id: 'capital', name: '🏛️ Центральный округ' },
      { id: 'south_harbor', name: '⚓ Южный порт' },
      { id: 'north_lands', name: '🌲 Северные пределы' },
    ];
  });

  const selectedRegions = ref<string[]>(['capital', 'south_harbor', 'north_lands']);

  const calendarTimezone = computed<string>(() => {
    const rawTz = (props.calendarData as Record<string, unknown> | null)?.calendar_timezone;
    if (typeof rawTz === 'string' && rawTz.length > 0) {
      return rawTz;
    }
    const projId = (props.calendarData as Record<string, unknown> | null)?.project_id as string | undefined;
    const planets = calendarStore.getPlanets(projId || 'default');
    const activePlanet = planets[0];
    if (activePlanet?.timezones && activePlanet.timezones.length > 0) {
      return activePlanet.timezones[0].code || 'UTC+3';
    }
    return 'UTC+3';
  });

  function updateSeasons(list: CultureSeasonDto[]) {
    emit('update', { сезоны: list });
  }

  function addSeason() {
    const list = [...seasons.value];
    list.push({
      название: `Сезон ${list.length + 1}`,
      цвет: 'var(--accent-purple)',
      hemisphere: 'northern',
      месяцы: [0],
    });
    updateSeasons(list);
  }

  function removeSeason(idx: number) {
    const list = seasons.value.filter((_, i) => i !== idx);
    updateSeasons(list);
  }

  function updateHolidays(list: CultureHolidayDto[]) {
    emit('update', { праздники: list });
  }

  function addHoliday() {
    const list = [...holidays.value];
    list.push({
      название: `Праздник ${list.length + 1}`,
      дата_начала: { месяц: 0, день: 1 },
      is_range: false,
    });
    updateHolidays(list);
  }

  function removeHoliday(idx: number) {
    const list = holidays.value.filter((_, i) => i !== idx);
    updateHolidays(list);
  }

  function updatePhaseNames(names: MoonPhaseNames) {
    phaseNames.value = { ...names };
    emit('update', { moon_phase_names: names } as unknown as Partial<CalendarData>);
  }

  function findDoubleFullMoon() {
    alert('🔮 Ближайшее Двойное Полнолуние: через 412 суток от точки отсчета!');
  }

  function updateAgeRule(patch: Partial<CharacterAgeRuleDto>) {
    emit('update', {
      character_age_rules: { ...ageRule.value, ...patch },
    } as unknown as Partial<CalendarData>);
  }

  function toggleRegion(id: string) {
    const list = [...selectedRegions.value];
    const idx = list.indexOf(id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(id);
    }
    selectedRegions.value = list;
    emit('update', { culture_regions: list } as unknown as Partial<CalendarData>);
  }

  function addRegion(name: string) {
    const id = `reg_${Date.now()}`;
    regionsList.value.push({ id, name: `📍 ${name}` });
    selectedRegions.value.push(id);
    emit('update', { culture_regions: selectedRegions.value } as unknown as Partial<CalendarData>);
  }

  function setCalendarTimezone(tz: string) {
    emit('update', { calendar_timezone: tz });
  }

  return {
    months,
    seasons,
    holidays,
    phaseNames,
    ageRule,
    regionsList,
    selectedRegions,
    calendarTimezone,
    updateSeasons,
    addSeason,
    removeSeason,
    updateHolidays,
    addHoliday,
    removeHoliday,
    updatePhaseNames,
    findDoubleFullMoon,
    updateAgeRule,
    toggleRegion,
    addRegion,
    setCalendarTimezone,
  };
}
