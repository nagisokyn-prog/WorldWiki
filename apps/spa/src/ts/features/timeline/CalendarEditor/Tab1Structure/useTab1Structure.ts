import { computed } from 'vue';
import type { CalendarMonth, CalendarSettings } from '@/services/Calendars/calendar.types';
import type { Tab1StructureProps, Tab1StructureEmits, CalendarWeekday } from './Tab1Structure.model';

export function useTab1Structure(
  props: Tab1StructureProps,
  emit: Tab1StructureEmits
) {
  const months = computed<CalendarMonth[]>(() => {
    return props.calendarData?.месяцы || [];
  });

  const weekdays = computed<CalendarWeekday[]>(() => {
    const rawNames = props.calendarData?.названия_дней_недели || [];
    return rawNames.map((name) => ({ название: name }));
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

  function updateMonths(newMonths: CalendarMonth[]) {
    emit('update', { месяцы: newMonths });
  }

  function updateWeekdays(newWeekdays: CalendarWeekday[]) {
    emit('update', { названия_дней_недели: newWeekdays.map((w) => w.название) });
  }

  function updateTimeSettings(newSettings: CalendarSettings) {
    emit('update', { настройки_времени: newSettings });
  }

  function updateExtraDays(count: number) {
    emit('update', { extra_days: count });
  }

  function balanceMonthsEvenly() {
    if (months.value.length === 0) return;
    const avg = Math.floor(360 / months.value.length);
    const updated = months.value.map((m) => ({ ...m, дней: avg }));
    updateMonths(updated);
  }

  return {
    months,
    weekdays,
    timeSettings,
    extraDays,
    totalYearDays,
    updateMonths,
    updateWeekdays,
    updateTimeSettings,
    updateExtraDays,
    balanceMonthsEvenly,
  };
}
