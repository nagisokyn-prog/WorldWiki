import { computed } from 'vue';
import type {
  Tab3CultureLoreProps,
  Tab3CultureLoreEmits,
  CultureMoonPhaseDto,
  CharacterAgeRuleDto,
} from './Tab3CultureLore.model';
import type { CalendarSeason, CalendarHoliday } from '@/services/Calendars/calendar.types';

export function useTab3CultureLore(
  props: Tab3CultureLoreProps,
  emit: Tab3CultureLoreEmits
) {
  const seasons = computed<CalendarSeason[]>(() => {
    return props.calendarData?.сезоны || [];
  });

  const holidays = computed<CalendarHoliday[]>(() => {
    return props.calendarData?.праздники || [];
  });

  const moonPhases = computed<CultureMoonPhaseDto[]>(() => {
    const raw = props.calendarData?.cultural_moon_phases;
    if (Array.isArray(raw)) {
      return raw as CultureMoonPhaseDto[];
    }
    return [
      { name: 'Новолуние (Темная Луна)', phase_index: 0 },
      { name: 'Первый Серп', phase_index: 1 },
      { name: 'Первая Четверть', phase_index: 2 },
      { name: 'Полнолуние (Великий Диск)', phase_index: 4 },
      { name: 'Последняя Четверть', phase_index: 6 },
    ];
  });

  const ageRule = computed<CharacterAgeRuleDto>(() => {
    const raw = props.calendarData?.character_age_rules;
    if (raw && typeof raw === 'object') {
      return raw as CharacterAgeRuleDto;
    }
    return {
      mode: 'tropical_years',
      ratio_to_earth: 1.0,
      step_on_new_year: false,
      age_at_birth: 0,
    };
  });

  const calendarTimezone = computed<string>(() => {
    return (props.calendarData?.calendar_timezone as string) || 'UTC+0';
  });

  // Сезоны
  function updateSeasons(list: CalendarSeason[]) {
    emit('update', { сезоны: list });
  }

  function addSeason() {
    const list = [...seasons.value];
    list.push({
      название: `Сезон ${list.length + 1}`,
      месяцы: [0],
      время_восхода: '06:00',
      время_заката: '18:00',
      описание: '',
    });
    updateSeasons(list);
  }

  function removeSeason(idx: number) {
    const list = seasons.value.filter((_, i) => i !== idx);
    updateSeasons(list);
  }

  // Праздники
  function updateHolidays(list: CalendarHoliday[]) {
    emit('update', { праздники: list });
  }

  function addHoliday() {
    const list = [...holidays.value];
    list.push({
      название: `Праздник ${list.length + 1}`,
      дата_начала: { месяц: 0, день: 1 },
      дата_конца: { месяц: 0, день: 1 },
      описание: '',
      is_intercalary: false,
    });
    updateHolidays(list);
  }

  function removeHoliday(idx: number) {
    const list = holidays.value.filter((_, i) => i !== idx);
    updateHolidays(list);
  }

  // Лунные фазы
  function updateMoonPhases(list: CultureMoonPhaseDto[]) {
    emit('update', { cultural_moon_phases: list as any });
  }

  function addMoonPhase() {
    const list = [...moonPhases.value];
    list.push({
      name: `Фаза ${list.length + 1}`,
      phase_index: 0,
      description: '',
    });
    updateMoonPhases(list);
  }

  function removeMoonPhase(idx: number) {
    const list = moonPhases.value.filter((_, i) => i !== idx);
    updateMoonPhases(list);
  }

  // Правила возраста
  function updateAgeRule(patch: Partial<CharacterAgeRuleDto>) {
    emit('update', {
      character_age_rules: { ...ageRule.value, ...patch } as any,
    });
  }

  function setCalendarTimezone(tz: string) {
    emit('update', { calendar_timezone: tz });
  }

  return {
    seasons,
    holidays,
    moonPhases,
    ageRule,
    calendarTimezone,
    updateSeasons,
    addSeason,
    removeSeason,
    updateHolidays,
    addHoliday,
    removeHoliday,
    updateMoonPhases,
    addMoonPhase,
    removeMoonPhase,
    updateAgeRule,
    setCalendarTimezone,
  };
}
