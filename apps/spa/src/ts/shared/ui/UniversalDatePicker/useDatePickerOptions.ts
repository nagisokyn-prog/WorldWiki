import { computed, type Ref } from 'vue';
import { CalendarMath } from '@/services/Calendars/calendar.math';
import type { CalendarData, CalendarEra, CalendarMonth } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';

export function useDatePickerOptions(
  allCalendars: Ref<CalendarRecord[]>,
  currentCalendarId: Ref<string>,
  currentEraIdx: Ref<number>,
  currentYear: Ref<number>,
  currentMonthIdx: Ref<number>
) {
  const calendar = computed<CalendarData | null>(() => {
    if (!currentCalendarId.value) return null;
    const calObj = allCalendars.value.find(c => c.id === currentCalendarId.value);
    return calObj ? (calObj.data || (calObj as unknown as CalendarData)) : null;
  });

  const calendarOptions = computed(() => {
    return allCalendars.value.map(c => ({
      value: c.id,
      label: (c.data || (c as unknown as CalendarData)).название || 'Календарь'
    }));
  });

  const eras = computed<CalendarEra[]>(() => calendar.value?.эпохи || []);
  const months = computed<CalendarMonth[]>(() => calendar.value?.месяцы || []);

  const currentEra = computed(() => eras.value[currentEraIdx.value] || eras.value[0] || { год_начала: 1, год_конца: 9999, название: '' });

  const yearRange = computed(() => currentEra.value.год_конца - currentEra.value.год_начала);
  const yearInputMode = computed(() => yearRange.value > 50);

  const timeSettings = computed(() => calendar.value?.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 });

  const eraOptions = computed(() => {
    return eras.value.map((e: CalendarEra, i: number) => ({ value: i, label: e.название || `Эпоха ${i + 1}` }));
  });

  const yearOptions = computed(() => {
    if (yearInputMode.value) return [];
    const opts = [];
    for (let i = currentEra.value.год_начала; i <= currentEra.value.год_конца; i++) {
      opts.push({ value: i, label: String(i) });
    }
    return opts;
  });

  const monthOptions = computed(() => {
    return months.value.map((m: CalendarMonth, i: number) => ({ value: i, label: m.название || `Месяц ${i + 1}` }));
  });

  const maxDaysInMonth = computed(() => {
    if (!calendar.value) return 30;
    return CalendarMath.getDaysInMonth(calendar.value, currentYear.value, currentMonthIdx.value);
  });

  const dayOptions = computed(() => {
    const opts = [];
    const max = maxDaysInMonth.value;
    for (let i = 1; i <= max; i++) {
      opts.push({ value: i, label: String(i) });
    }
    return opts;
  });

  const hourOptions = computed(() => {
    const opts = [];
    for (let i = 0; i < timeSettings.value.часов_в_сутках; i++) {
      opts.push({ value: i, label: String(i).padStart(2, '0') });
    }
    return opts;
  });

  const minuteOptions = computed(() => {
    const opts = [];
    for (let i = 0; i < timeSettings.value.минут_в_часе; i++) {
      opts.push({ value: i, label: String(i).padStart(2, '0') });
    }
    return opts;
  });

  return {
    calendar,
    calendarOptions,
    eras,
    months,
    currentEra,
    yearRange,
    yearInputMode,
    timeSettings,
    eraOptions,
    yearOptions,
    monthOptions,
    maxDaysInMonth,
    dayOptions,
    hourOptions,
    minuteOptions
  };
}
