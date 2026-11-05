import { computed, ref } from 'vue';
import type { CalendarData, CalendarMonth, CalendarSettings, CalendarSeason } from '@/services/Calendars/calendar.types';
import type {
  Tab1StructureProps,
  Tab1StructureEmits,
  CalendarWeekday,
  DialPreset,
  WeekPreset,
  DayStartMode,
  LeapRuleDto,
} from './Tab1Structure.model';
import type { DialUnit } from '@worldwiki/calendar-wasm';
import { useTab1Leap } from './useTab1Leap';

export function useTab1Structure(
  props: Tab1StructureProps,
  emit: Tab1StructureEmits
) {
  // Месяцы года
  const months = computed<CalendarMonth[]>(() => {
    return props.calendarData?.месяцы || [];
  });

  // Сезоны года
  const seasons = computed<CalendarSeason[]>(() => {
    return props.calendarData?.сезоны || [];
  });

  // Дни недели
  const weekdays = computed<CalendarWeekday[]>(() => {
    const rawNames = props.calendarData?.названия_дней_недели || [];
    return rawNames.map((name) => ({ название: name }));
  });

  // Заморозка дней недели на время праздников
  const pauseOnHolidays = computed<boolean>(() => {
    return Boolean(props.calendarData?.pause_on_holidays);
  });

  // Циферблат суток (DialHierarchy)
  const dialUnits = computed<DialUnit[]>(() => {
    const raw = props.calendarData?.dial_units;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as DialUnit[];
    }
    return [
      { name: 'Час', subdivisions: 24 },
      { name: 'Минута', subdivisions: 60 },
      { name: 'Секунда', subdivisions: 60 },
    ];
  });

  // Момент смены суток
  const dayStartOffset = computed<string>(() => {
    return String(props.calendarData?.day_start_offset ?? 'midnight');
  });

  // Високосные правила (legacy DTO)
  const leapRules = computed<LeapRuleDto[]>(() => {
    const raw = props.calendarData?.правило_високосного_года;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as LeapRuleDto[];
    }
    return [{ interval: 4, day_offset: 1, target_month: 1 }];
  });

  const timeSettings = computed<CalendarSettings | undefined>(() => {
    return props.calendarData?.настройки_времени;
  });

  const extraDays = computed<number>(() => {
    return Number(props.calendarData?.extra_days) || 0;
  });

  const totalYearDays = computed<number>(() => {
    const monthsDays = months.value.reduce((sum, m) => sum + (Number(m.дней) || 0), 0);
    return monthsDays + extraDays.value;
  });

  // Пресеты циферблата
  function applyDialPreset(preset: DialPreset) {
    let units: DialUnit[] = [];
    if (preset === 'earth') {
      units = [
        { name: 'Час', subdivisions: 24 },
        { name: 'Минута', subdivisions: 60 },
        { name: 'Секунда', subdivisions: 60 },
      ];
    } else if (preset === 'fantasy') {
      units = [
        { name: 'Стража', subdivisions: 4 },
        { name: 'Колокол', subdivisions: 6 },
        { name: 'Удар гонга', subdivisions: 100 },
      ];
    } else if (preset === 'metric') {
      units = [
        { name: 'Десятичный час', subdivisions: 10 },
        { name: 'Десятичная минута', subdivisions: 100 },
        { name: 'Десятичная секунда', subdivisions: 100 },
      ];
    } else if (preset === 'agrarian') {
      units = [{ name: 'Сутки', subdivisions: 1 }];
    }
    emit('update', { dial_units: units });
  }

  function setDayStartOffset(offset: DayStartMode) {
    emit('update', { day_start_offset: offset as unknown as number });
  }

  // Пресеты недели
  function applyWeekPreset(preset: WeekPreset) {
    let names: string[] = [];
    if (preset === 7) {
      names = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    } else if (preset === 6) {
      names = ['День 1 (Прима)', 'День 2 (Секунда)', 'День 3 (Терция)', 'День 4 (Кварта)', 'День 5 (Квинта)', 'День 6 (Шаббат)'];
    } else if (preset === 10) {
      names = Array.from({ length: 10 }, (_, i) => `Декада ${i + 1}`);
    } else if (preset === 5) {
      names = ['День Солнца', 'День Воды', 'День Дерева', 'День Огня', 'День Земли'];
    }
    emit('update', { названия_дней_недели: names });
  }

  function reorderWeekday(idx: number, direction: -1 | 1) {
    const list = [...weekdays.value.map((w) => w.название)];
    const targetIdx = idx + direction;
    if (targetIdx >= 0 && targetIdx < list.length) {
      const temp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = temp;
      emit('update', { названия_дней_недели: list });
    }
  }

  function addCustomWeekday(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const list = [...weekdays.value.map((w) => w.название), trimmed];
    emit('update', { названия_дней_недели: list });
  }

  function removeWeekday(idx: number) {
    if (weekdays.value.length <= 1) return;
    const list = weekdays.value.map((w) => w.название).filter((_, i) => i !== idx);
    emit('update', { названия_дней_недели: list });
  }

  function setPauseOnHolidays(val: boolean) {
    emit('update', { pause_on_holidays: val });
  }

  // Месяцы
  function updateMonths(newMonths: CalendarMonth[]) {
    emit('update', { месяцы: newMonths });
  }

  function addMonth() {
    const updated = [
      ...months.value,
      { название: `Месяц ${months.value.length + 1}`, дней: 30 },
    ];
    updateMonths(updated);
  }

  function balanceMonthsEvenly() {
    if (months.value.length === 0) return;
    const avg = Math.floor(360 / months.value.length);
    const updated = months.value.map((m) => ({ ...m, дней: avg }));
    updateMonths(updated);
  }

  const newWeekdayName = ref('');

  function addNewDay() {
    const trimmed = newWeekdayName.value.trim();
    if (trimmed) {
      addCustomWeekday(trimmed);
      newWeekdayName.value = '';
    }
  }

  const firstMonthOfYear = computed<number>(() => {
    return props.calendarData?.первый_месяц_года ?? 0;
  });

  const newYearDay = computed<number>(() => {
    return Number((props.calendarData as Record<string, unknown>)?.день_начала_года) || 1;
  });

  function setFirstMonthOfYear(monthIndex: number) {
    emit('update', { первый_месяц_года: monthIndex });
  }

  function setNewYearDay(day: number) {
    emit('update', { день_начала_года: day } as unknown as Partial<CalendarData>);
  }

  // Високосы
  function updateLeapRules(rules: LeapRuleDto[]) {
    emit('update', { правило_високосного_года: rules as unknown as string });
  }

  function updateLeapRuleField(field: 'interval' | 'day_offset' | 'target_month', val: number) {
    const current = leapRules.value[0] || { interval: 4, day_offset: 1, target_month: 1 };
    const updated = [{ ...current, [field]: val }];
    updateLeapRules(updated);
  }

  // Подключаем специализированный WASM composable високосов
  const leap = useTab1Leap(
    () => props.calendarData,
    () => props.planetOrbitDays,
    emit
  );

  return {
    months,
    seasons,
    weekdays,
    pauseOnHolidays,
    dialUnits,
    dayStartOffset,
    leapRules,
    timeSettings,
    extraDays,
    totalYearDays,
    firstMonthOfYear,
    newYearDay,
    setFirstMonthOfYear,
    setNewYearDay,
    applyDialPreset,
    setDayStartOffset,
    applyWeekPreset,
    reorderWeekday,
    addCustomWeekday,
    removeWeekday,
    setPauseOnHolidays,
    updateMonths,
    addMonth,
    balanceMonthsEvenly,
    updateLeapRules,
    newWeekdayName,
    addNewDay,
    updateLeapRuleField,
    leap,
  };
}
