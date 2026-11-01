import { computed, ref, watch } from 'vue';
import { useCalendarStore } from '@/stores/calendar.store';
import type {
  Tab3CultureLoreProps,
  Tab3CultureLoreEmits,
  CultureSeasonDto,
  CultureHolidayDto,
  CharacterAgeRuleDto,
} from './Tab3CultureLore.model';
import type { CalendarData, CalendarMonth, MoonPhaseNames, PlanetEntity, WorldRegion } from '@/services/Calendars/calendar.types';

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
    const raw = (props.calendarData as Record<string, unknown>)?.character_age_rules as CharacterAgeRuleDto | undefined;
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

  const effectiveProjectId = computed<string>(() => {
    return props.projectId || (props.calendarData as Record<string, unknown>)?.project_id as string || 'default';
  });

  const currentPlanet = computed<PlanetEntity | null>(() => {
    const projId = effectiveProjectId.value;
    const planets = calendarStore.getPlanets(projId);
    if (!planets || planets.length === 0) return null;
    const targetPlanetId = props.planetId || props.calendarData?.planet_id;
    if (targetPlanetId) {
      const cleanTarget = String(targetPlanetId).replace(/^planets?:/, '');
      const found = planets.find(
        (p) => String(p.id).replace(/^planets?:/, '') === cleanTarget || p.name === targetPlanetId
      );
      if (found) return found;
    }
    return planets[0] || null;
  });

  const regionsList = computed<{ id: string; name: string }[]>(() => {
    const activePlanet = currentPlanet.value;
    if (activePlanet && Array.isArray(activePlanet.regions) && activePlanet.regions.length > 0) {
      return activePlanet.regions.map((r, i) => ({
        id: (r as { id?: string; code?: string }).id || (r as { id?: string; code?: string }).code || `reg_${i}`,
        name: r.name || `Регион ${i + 1}`,
      }));
    }
    return [
      { id: 'capital', name: '🏛️ Центральный округ' },
      { id: 'south_harbor', name: '⚓ Южный порт' },
      { id: 'north_lands', name: '🌲 Северные пределы' },
    ];
  });

  const timezonesList = computed<{ value: string; label: string }[]>(() => {
    const activePlanet = currentPlanet.value;
    if (activePlanet && Array.isArray(activePlanet.timezones) && activePlanet.timezones.length > 0) {
      return activePlanet.timezones.map((tz) => ({
        value: tz.code || tz.name,
        label: `${tz.name} (${tz.code || ''}${tz.base_offset_hours !== undefined ? (tz.base_offset_hours >= 0 ? ` +${tz.base_offset_hours}ч` : ` ${tz.base_offset_hours}ч`) : ''})`,
      }));
    }
    return [
      { value: 'UTC+0', label: 'Столичный меридиан (UTC+0, 0ч)' },
      { value: 'UTC+1', label: 'Центральная Европа (UTC+1, +1ч)' },
      { value: 'UTC+2', label: 'Восточноевропейский пояс (UTC+2, +2ч)' },
      { value: 'UTC+3', label: 'Московское время (UTC+3, +3ч)' },
      { value: 'UTC+8', label: 'Восточная Азия / Китай (UTC+8, +8ч)' },
      { value: 'UTC+9', label: 'Япония / Корея (UTC+9, +9ч)' },
      { value: 'UTC-5', label: 'Восточное побережье США (UTC-5, -5ч)' },
    ];
  });

  const selectedRegions = ref<string[]>(
    (props.calendarData as Record<string, unknown>)?.culture_regions as string[] ||
    props.calendarData?.region_ids ||
    ['capital', 'south_harbor', 'north_lands']
  );

  const calendarTimezone = computed<string>(() => {
    const rawTz = (props.calendarData as Record<string, unknown> | null)?.calendar_timezone;
    if (typeof rawTz === 'string' && rawTz.length > 0) {
      return rawTz;
    }
    const activePlanet = currentPlanet.value;
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
      название: 'Новый праздник',
      дата_начала: { месяц: 0, день: 1 },
      is_range: false,
    });
    updateHolidays(list);
  }

  function removeHoliday(idx: number) {
    const list = holidays.value.filter((_, i) => i !== idx);
    updateHolidays(list);
  }

  function updatePhaseNames(patch: MoonPhaseNames) {
    phaseNames.value = { ...patch };
    emit('update', {
      moon_phase_names: { ...patch },
      moons: [
        {
          name: props.calendarData?.moons?.[0]?.name || 'Луна',
          period_days: props.calendarData?.moons?.[0]?.period_days ?? 29.530588,
          phase_names: { ...patch },
        },
      ],
    } as unknown as Partial<CalendarData>);
  }

  function findDoubleFullMoon() {
    return null;
  }

  function updateAgeRule(patch: Partial<CharacterAgeRuleDto>) {
    const current = ageRule.value;
    emit('update', {
      character_age_rules: { ...current, ...patch },
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
    emit('update', { culture_regions: list, region_ids: list } as unknown as Partial<CalendarData>);
  }

  async function addRegion(name: string) {
    const id = `reg_${Date.now()}`;
    const activePlanet = currentPlanet.value;
    if (activePlanet) {
      const newRegion: WorldRegion = {
        id,
        name,
        timezone_id: calendarTimezone.value,
        latitude: 50.0,
        longitude: 0.0,
      };
      const updatedRegions = [...(activePlanet.regions || []), newRegion];
      await calendarStore.savePlanet(effectiveProjectId.value, {
        ...activePlanet,
        regions: updatedRegions,
      });
    }
    selectedRegions.value.push(id);
    emit('update', { culture_regions: selectedRegions.value, region_ids: selectedRegions.value } as unknown as Partial<CalendarData>);
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
    timezonesList,
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
