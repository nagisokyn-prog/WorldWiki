import { ref, computed, type Ref } from 'vue';
import { CalendarMath } from '@/services/Calendars/calendar.math';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarMonth, CalendarEra } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { DatePickerModelValue } from '@/shared/ui/UniversalDatePicker/useUniversalDatePicker';
import type { DiegeticDateBadgeInfo, TimelineEventOption } from './PromiseCardMeta.model';

export function usePromiseDateTime(
  calendars: Ref<CalendarRecord[]>,
  emitChange: () => void
) {
  const isDatePickerOpen = ref(false);
  const currentCalendarId = ref('');
  const currentEraIdx = ref(0);
  const currentYear = ref(1);
  const currentMonthIdx = ref(0);
  const currentDay = ref(1);
  const currentHour = ref(0);
  const currentMinute = ref(0);
  const universalDateModel = ref<DatePickerModelValue | null>(null);

  const activeCalendar = computed<CalendarRecord | null>(() => {
    if (calendars.value.length === 0) return null;
    if (currentCalendarId.value) {
      const found = calendars.value.find(c => c.id === currentCalendarId.value);
      if (found) return found;
    }
    if (universalDateModel.value?.calendar_id) {
      const found = calendars.value.find(c => c.id === universalDateModel.value?.calendar_id);
      if (found) return found;
    }
    const def = calendars.value.find(c => c.is_default || c.is_master);
    return def || calendars.value[0] || null;
  });

  const getCalendarData = (cal: CalendarRecord | null): CalendarData | null => {
    if (!cal) return null;
    if (cal.data && typeof cal.data === 'object' && 'data' in cal.data && typeof (cal.data as Record<string, unknown>).data === 'object') {
      return (cal.data as Record<string, unknown>).data as CalendarData;
    }
    return (cal.data as CalendarData) || null;
  };

  const activeCalendarMonths = computed<CalendarMonth[]>(() => {
    const calData = getCalendarData(activeCalendar.value);
    return calData?.месяцы || [{ название: 'Январь', дней: 30 }];
  });

  const activeCalendarEras = computed<CalendarEra[]>(() => {
    const calData = getCalendarData(activeCalendar.value);
    return calData?.эпохи || [{ название: 'Наша эра', год_начала: 1, год_конца: 9999 }];
  });

  const maxDaysInCurrentMonth = computed<number>(() => {
    const months = activeCalendarMonths.value;
    const m = months[currentMonthIdx.value];
    return m?.дней || 30;
  });

  const eraWheelOptions = computed(() => {
    return activeCalendarEras.value.map((e, idx) => ({
      value: idx,
      label: e.название || e.name || `Эпоха ${idx + 1}`
    }));
  });

  const yearWheelOptions = computed(() => {
    const y = currentYear.value;
    const list: Array<{ value: number; label: string }> = [];
    for (let i = Math.max(1, y - 15); i <= y + 15; i++) {
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

  const syncStateFromInput = (input: {
    era_index?: number;
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
  }, calId?: string) => {
    if (calId) currentCalendarId.value = calId;
    currentEraIdx.value = Number(input.era_index) || 0;
    currentYear.value = Number(input.year) || 1;
    currentMonthIdx.value = Number(input.month) || 0;
    currentDay.value = Number(input.day) || 1;
    currentHour.value = Number(input.hour) || 0;
    currentMinute.value = Number(input.minute) || 0;
  };

  const syncModelFromMabs = (mAbs: number, cal: CalendarRecord) => {
    const calData = getCalendarData(cal);
    if (!calData) return;
    const dateInput = CalendarMath.getDateFromAbsolute(mAbs, calData);
    syncStateFromInput(dateInput, cal.id);
    universalDateModel.value = {
      calendar_id: cal.id,
      absolute_minute: mAbs,
      original_input: dateInput,
      эпоха_ключ: dateInput.era_index,
      год: dateInput.year,
      месяц: dateInput.month,
      день: dateInput.day
    };
  };

  const onDateFieldsChange = () => {
    const cal = activeCalendar.value;
    const calData = getCalendarData(cal);
    if (!cal || !calData) return;

    const input = {
      era_index: Number(currentEraIdx.value) || 0,
      year: Number(currentYear.value) || 1,
      month: Number(currentMonthIdx.value) || 0,
      day: Number(currentDay.value) || 1,
      hour: Number(currentHour.value) || 0,
      minute: Number(currentMinute.value) || 0
    };

    const mAbs = CalendarMath.getAbsoluteMinute(input, calData);
    universalDateModel.value = {
      calendar_id: cal.id,
      absolute_minute: mAbs,
      original_input: input,
      эпоха_ключ: input.era_index,
      год: input.year,
      месяц: input.month,
      день: input.day
    };
    emitChange();
  };

  const onUniversalDateChange = (val: unknown) => {
    if (!val || typeof val !== 'object') return;
    const model = val as DatePickerModelValue;
    universalDateModel.value = model;
    if (model.original_input) {
      syncStateFromInput(model.original_input, model.calendar_id);
    }
    emitChange();
  };

  const toggleDatePicker = () => {
    isDatePickerOpen.value = !isDatePickerOpen.value;
  };

  const syncInitialTimelineDate = (timelineEventId?: string | null, eventsList: TimelineEventOption[] = []) => {
    if (timelineEventId) {
      const ev = eventsList.find(e => e.id === timelineEventId);
      if (ev && ev.m_abs !== undefined && calendars.value.length > 0) {
        const cal = activeCalendar.value || calendars.value[0];
        syncModelFromMabs(ev.m_abs, cal);
      }
    } else if (calendars.value.length > 0) {
      const cal = activeCalendar.value || calendars.value[0];
      if (cal && cal.id) {
        currentCalendarId.value = cal.id;
      }
    }
  };

  return {
    isDatePickerOpen,
    currentCalendarId,
    currentEraIdx,
    currentYear,
    currentMonthIdx,
    currentDay,
    currentHour,
    currentMinute,
    universalDateModel,
    activeCalendar,
    activeCalendarMonths,
    activeCalendarEras,
    maxDaysInCurrentMonth,
    eraWheelOptions,
    yearWheelOptions,
    monthWheelOptions,
    dayWheelOptions,
    hourWheelOptions,
    minuteWheelOptions,
    diegeticInfo,
    onDateFieldsChange,
    onUniversalDateChange,
    toggleDatePicker,
    syncInitialTimelineDate
  };
}
