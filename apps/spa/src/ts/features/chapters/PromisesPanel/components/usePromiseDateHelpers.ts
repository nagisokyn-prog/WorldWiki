import { computed, type Ref } from 'vue';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarMonth, CalendarEra } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { DiegeticDateBadgeInfo } from './PromiseCardMeta.model';

export function usePromiseDateHelpers(
  activeCalendar: Ref<CalendarRecord | null>,
  activeCalendarMonths: Ref<CalendarMonth[]>,
  activeCalendarEras: Ref<CalendarEra[]>,
  maxDaysInCurrentMonth: Ref<number>,
  currentYear: Ref<number>,
  currentEraIdx: Ref<number>,
  currentMonthIdx: Ref<number>,
  currentDay: Ref<number>,
  currentHour: Ref<number>,
  currentMinute: Ref<number>,
  getCalendarData: (cal: CalendarRecord | null) => CalendarData | null
) {
  const eraWheelOptions = computed(() => {
    return activeCalendarEras.value.map((e, idx) => ({
      value: idx,
      label: e.название || e.name || `Эпоха ${idx + 1}`
    }));
  });

  const yearWheelOptions = computed(() => {
    const y = Number(currentYear.value) || 1;
    const min = Math.max(1, y - 50);
    const max = Math.max(100, y + 50);
    const list: Array<{ value: number; label: string }> = [];
    for (let i = min; i <= max; i++) {
      list.push({ value: i, label: String(i) });
    }
    return list;
  });

  const monthWheelOptions = computed(() => {
    return activeCalendarMonths.value.map((m, idx) => ({
      value: idx,
      label: m.название || `Месяц ${idx + 1}`
    }));
  });

  const dayWheelOptions = computed(() => {
    return Array.from({ length: maxDaysInCurrentMonth.value }, (_, i) => ({
      value: i + 1,
      label: String(i + 1)
    }));
  });

  const hourWheelOptions = computed(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      value: i,
      label: String(i).padStart(2, '0')
    }));
  });

  const minuteWheelOptions = computed(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i * 5,
      label: String(i * 5).padStart(2, '0')
    }));
  });

  const getSeasonClass = (seasonName: string): string => {
    const s = seasonName.toLowerCase();
    if (s.includes('весн') || s.includes('spring')) return 'season-spring';
    if (s.includes('лет') || s.includes('summer')) return 'season-summer';
    if (s.includes('осен') || s.includes('autumn') || s.includes('fall')) return 'season-autumn';
    if (s.includes('зим') || s.includes('winter')) return 'season-winter';
    return 'season-default';
  };

  const getTimeOfDay = (hour: number = 0): string => {
    const h = Number(hour) || 0;
    if (h >= 5 && h < 12) return '🌅 Утро';
    if (h >= 12 && h < 18) return '☀️ День';
    if (h >= 18 && h < 23) return '🌇 Вечер';
    return '🌙 Ночь';
  };

  const diegeticInfo = computed<DiegeticDateBadgeInfo | null>(() => {
    const cal = activeCalendar.value;
    const calData = getCalendarData(cal);
    if (!cal || !calData) return null;

    const input = {
      era_index: Number(currentEraIdx.value) || 0,
      year: Number(currentYear.value) || 1,
      month: Number(currentMonthIdx.value) || 0,
      day: Number(currentDay.value) || 1,
      hour: Number(currentHour.value) || 0,
      minute: Number(currentMinute.value) || 0
    };

    const seasonName = CalendarFormat.getSeasonForDate(calData, input.year, input.month);
    const hasValidSeason = seasonName && seasonName !== 'Вне сезона';
    const seasonClass = getSeasonClass(seasonName || '');
    const timeOfDayName = getTimeOfDay(input.hour);
    const mAbs = CalendarMath.getAbsoluteMinute(input, calData);

    const formattedDate = CalendarFormat.formatDate(calData, {
      original_input: input,
      calendar_id: cal.id || '',
      absolute_minute: mAbs
    });

    const eraName = activeCalendarEras.value[input.era_index]?.название || '';
    const monthName = activeCalendarMonths.value[input.month]?.название || `Месяц ${input.month + 1}`;
    const fallbackDate = `${input.year} год, ${monthName} ${input.day}${eraName ? ` (${eraName})` : ''} в ${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}`;

    return {
      calendarName: cal.name || 'Календарь',
      seasonName: hasValidSeason ? seasonName : '',
      seasonClass,
      timeOfDayName,
      formattedDate: formattedDate || fallbackDate,
      mAbs
    };
  });

  return {
    eraWheelOptions,
    yearWheelOptions,
    monthWheelOptions,
    dayWheelOptions,
    hourWheelOptions,
    minuteWheelOptions,
    diegeticInfo
  };
}
