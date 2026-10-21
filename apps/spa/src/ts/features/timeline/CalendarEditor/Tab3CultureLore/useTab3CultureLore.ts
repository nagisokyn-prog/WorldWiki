import { computed, ref } from 'vue';
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
    new: 'Темная Ночь / Ночь Воров',
    waxing: 'Серп Охотника',
    full: 'Око Саурона / Кровавая Луна',
    waning: 'Ущерб / Тающий Лик',
  });

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

  const regionsList = ref<{ id: string; name: string }[]>([
    { id: 'capital', name: '🏛️ Столица Империи' },
    { id: 'south_harbor', name: '⚓ Южная Гавань' },
    { id: 'north_lands', name: '🌲 Северные Земли' },
    { id: 'archipelago', name: '🏝️ Дальний Архипелаг' },
    { id: 'desert', name: '🏜️ Пустыня Забвения' },
  ]);

  const selectedRegions = ref<string[]>(['capital', 'south_harbor', 'north_lands']);

  const calendarTimezone = computed<string>(() => {
    return (props.calendarData?.calendar_timezone as string) || 'UTC+0';
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
