import { ref, computed, type Ref } from 'vue';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarMonth, CalendarEra } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { DatePickerModelValue } from '@/shared/ui/UniversalDatePicker/useUniversalDatePicker';
import type { DatePrecision, TimeOfDayPreset } from '@/types/narrative';
import type { TimelineEventOption } from './PromiseCardMeta.model';
import { usePromiseDateHelpers } from './usePromiseDateHelpers';
import { extractCalendarData, resolveEraIndexForMabs, computeFuzzyEndMabs, applyCompoundDateShift } from './promiseDateFuzzy';
import type { TimeJumpPreset } from '../PromiseCardTimeline/timeJumpPresets';

const TIME_OF_DAY_HOURS: Record<TimeOfDayPreset, number> = { morning: 8, day: 13, evening: 19, night: 23 };

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
  const datePrecision = ref<DatePrecision>('exact');
  const isApproximate = ref(false);
  const timeOfDay = ref<TimeOfDayPreset | null>(null);
  const endYear = ref(1);
  const endMonthIdx = ref(0);
  const currentSeasonIdx = ref(0);
  const computedMabsEnd = ref<number | null>(null);
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
    return calendars.value.find(c => c.is_default || c.is_master) || calendars.value[0] || null;
  });

  const activeCalendarMonths = computed<CalendarMonth[]>(() => {
    return extractCalendarData(activeCalendar.value)?.месяцы || [{ название: 'Январь', дней: 30 }];
  });

  const activeCalendarEras = computed<CalendarEra[]>(() => {
    return extractCalendarData(activeCalendar.value)?.эпохи || [{ название: 'Наша эра', год_начала: 1, год_конца: 9999 }];
  });

  const maxDaysInCurrentMonth = computed<number>(() => {
    return activeCalendarMonths.value[currentMonthIdx.value]?.дней || 30;
  });

  const helpers = usePromiseDateHelpers(
    activeCalendar, activeCalendarMonths, activeCalendarEras, maxDaysInCurrentMonth,
    currentYear, currentEraIdx, currentMonthIdx, currentDay, currentHour, currentMinute,
    extractCalendarData,
    { datePrecision, isApproximate, timeOfDay, endYear, endMonthIdx, currentSeasonIdx }
  );

  const syncStateFromInput = (
    input: { era_index?: number; year?: number; month?: number; day?: number; hour?: number; minute?: number },
    calId?: string
  ) => {
    if (calId) currentCalendarId.value = calId;
    currentEraIdx.value = Number(input.era_index) || 0;
    currentYear.value = Number(input.year) || 1;
    currentMonthIdx.value = Number(input.month) || 0;
    currentDay.value = Number(input.day) || 1;
    currentHour.value = Number(input.hour) || 0;
    currentMinute.value = Number(input.minute) || 0;
  };

  const syncModelFromMabs = (mAbs: number, cal: CalendarRecord, explicitEraIdx?: number) => {
    const calData = extractCalendarData(cal);
    if (!calData) return;
    const resolvedEraIdx = resolveEraIndexForMabs(mAbs, calData, explicitEraIdx);
    const dateInput = CalendarMath.getDateFromAbsolute(mAbs, calData, resolvedEraIdx);
    dateInput.era_index = resolvedEraIdx;
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

  const currentInput = () => ({
    era_index: Number(currentEraIdx.value) || 0,
    year: Number(currentYear.value) || 1,
    month: Number(currentMonthIdx.value) || 0,
    day: Number(currentDay.value) || 1,
    hour: Number(currentHour.value) || 0,
    minute: Number(currentMinute.value) || 0
  });

  const onDateFieldsChange = () => {
    const cal = activeCalendar.value;
    const calData = extractCalendarData(cal);
    if (!cal || !calData) return;
    const input = currentInput();
    const mAbs = CalendarMath.getAbsoluteMinute(input, calData);
    computedMabsEnd.value = computeFuzzyEndMabs({
      calData, months: activeCalendarMonths.value, seasons: helpers.calendarSeasons.value,
      precision: datePrecision.value, eraIdx: input.era_index, startYear: input.year,
      startMonthIdx: input.month, endYear: endYear.value, endMonthIdx: endMonthIdx.value, seasonIdx: currentSeasonIdx.value
    });
    universalDateModel.value = {
      calendar_id: cal.id, absolute_minute: mAbs, original_input: input,
      эпоха_ключ: input.era_index, год: input.year, месяц: input.month, день: input.day
    };
    emitChange();
  };

  const setCalendar = (calId: string) => {
    if (!calId || currentCalendarId.value === calId) return;
    currentCalendarId.value = calId;
    onDateFieldsChange();
  };

  const shiftByMinutes = (deltaMinutes: number) => {
    const cal = activeCalendar.value;
    const calData = extractCalendarData(cal);
    if (!cal || !calData || !Number.isFinite(deltaMinutes)) return;
    const baseMabs = universalDateModel.value?.absolute_minute ?? CalendarMath.getAbsoluteMinute(currentInput(), calData);
    const era = activeCalendarEras.value[currentEraIdx.value];
    const isReverse = Boolean(era?.обратный_отсчет || currentYear.value < 0);
    syncModelFromMabs(baseMabs + (isReverse ? -Math.round(deltaMinutes) : Math.round(deltaMinutes)), cal, currentEraIdx.value);
    if (datePrecision.value !== 'exact' && datePrecision.value !== 'day') datePrecision.value = 'exact';
    onDateFieldsChange();
  };

  const shiftByPreset = (preset: Omit<TimeJumpPreset, 'id'>) => {
    const cal = activeCalendar.value;
    const calData = extractCalendarData(cal);
    if (!cal || !calData) return;
    const inp = currentInput();
    const nextMabs = applyCompoundDateShift({
      calData, eraIdx: inp.era_index, year: inp.year, monthIdx: inp.month, day: inp.day, hour: inp.hour, minute: inp.minute,
      sign: preset.sign, years: preset.years, months: preset.months, days: preset.days,
      dialUnits: preset.dialUnits, dialChips: helpers.dialDeltaChips.value
    });
    syncModelFromMabs(nextMabs, cal, currentEraIdx.value);
    onDateFieldsChange();
  };

  const applyTimeOfDay = (preset: TimeOfDayPreset | null) => {
    timeOfDay.value = preset;
    if (preset) {
      currentHour.value = TIME_OF_DAY_HOURS[preset];
      currentMinute.value = 0;
      if (datePrecision.value !== 'exact' && datePrecision.value !== 'day') datePrecision.value = 'day';
    }
    onDateFieldsChange();
  };

  const setPrecision = (nextPrecision: DatePrecision) => {
    datePrecision.value = nextPrecision;
    if (nextPrecision === 'range') {
      endYear.value = currentYear.value;
      endMonthIdx.value = Math.min(Math.max(0, activeCalendarMonths.value.length - 1), currentMonthIdx.value + 1);
    } else if (nextPrecision === 'season' && helpers.calendarSeasons.value.length > 0) {
      const matchedIdx = helpers.calendarSeasons.value.findIndex((s) => s.месяцы.includes(currentMonthIdx.value));
      currentSeasonIdx.value = matchedIdx >= 0 ? matchedIdx : 0;
      const firstMonth = helpers.calendarSeasons.value[currentSeasonIdx.value]?.месяцы[0];
      if (firstMonth !== undefined) currentMonthIdx.value = firstMonth;
    }
    onDateFieldsChange();
  };

  const onSeasonChange = (seasonIdx: number) => {
    currentSeasonIdx.value = seasonIdx;
    const firstMonth = helpers.calendarSeasons.value[seasonIdx]?.месяцы[0];
    if (firstMonth !== undefined) currentMonthIdx.value = firstMonth;
    onDateFieldsChange();
  };

  const toggleApproximate = () => {
    isApproximate.value = !isApproximate.value;
    onDateFieldsChange();
  };

  const onUniversalDateChange = (val: unknown) => {
    if (!val || typeof val !== 'object') return;
    const model = val as DatePickerModelValue;
    universalDateModel.value = model;
    if (model.original_input) syncStateFromInput(model.original_input, model.calendar_id);
    emitChange();
  };

  const toggleDatePicker = () => { isDatePickerOpen.value = !isDatePickerOpen.value; };

  const syncInitialTimelineDate = (
    itemData?: {
      date_fields?: { era_index?: number; year?: number; month?: number; day?: number; hour?: number; minute?: number } | null;
      m_abs?: number | null;
      m_abs_end?: number | null;
      date_precision?: DatePrecision | null;
      is_approximate?: boolean | null;
      time_of_day?: TimeOfDayPreset | null;
      calendar_id?: string | null;
      timeline_event_id?: string | null;
    } | null,
    timelineEventId?: string | null,
    eventsList: TimelineEventOption[] = []
  ) => {
    if (itemData?.calendar_id) currentCalendarId.value = itemData.calendar_id;
    datePrecision.value = itemData?.date_precision || 'exact';
    isApproximate.value = Boolean(itemData?.is_approximate);
    timeOfDay.value = itemData?.time_of_day ?? null;
    computedMabsEnd.value = itemData?.m_abs_end ?? null;

    const applyEnd = (cal: CalendarRecord | null) => {
      if (itemData?.m_abs_end != null && cal) {
        const cd = extractCalendarData(cal);
        if (cd) {
          const endDate = CalendarMath.getDateFromAbsolute(itemData.m_abs_end, cd, currentEraIdx.value);
          endYear.value = endDate.year;
          endMonthIdx.value = endDate.month;
          return;
        }
      }
      endYear.value = currentYear.value;
      endMonthIdx.value = currentMonthIdx.value;
    };

    if (itemData?.date_fields) {
      syncStateFromInput(itemData.date_fields, itemData.calendar_id || undefined);
      applyEnd(activeCalendar.value);
      return;
    }
    if (itemData?.m_abs != null && calendars.value.length > 0) {
      const cal = (itemData.calendar_id && calendars.value.find(c => c.id === itemData.calendar_id)) || activeCalendar.value || calendars.value[0];
      if (cal) {
        syncModelFromMabs(itemData.m_abs, cal);
        applyEnd(cal);
        return;
      }
    }
    const tid = itemData?.timeline_event_id || timelineEventId;
    if (tid) {
      const ev = eventsList.find(e => e.id === tid);
      if (ev?.m_abs !== undefined && calendars.value.length > 0) {
        const cal = activeCalendar.value || calendars.value[0];
        if (ev.date_precision) datePrecision.value = ev.date_precision as DatePrecision;
        if (ev.is_approximate != null) isApproximate.value = Boolean(ev.is_approximate);
        if (ev.time_of_day) timeOfDay.value = ev.time_of_day as TimeOfDayPreset;
        if (cal) syncModelFromMabs(ev.m_abs, cal);
        return;
      }
    }
    const fallbackCal = activeCalendar.value || calendars.value[0];
    if (fallbackCal?.id) currentCalendarId.value = fallbackCal.id;
  };

  return {
    isDatePickerOpen, currentCalendarId, currentEraIdx, currentYear, currentMonthIdx, currentDay, currentHour, currentMinute,
    datePrecision, isApproximate, timeOfDay, endYear, endMonthIdx, currentSeasonIdx, computedMabsEnd, universalDateModel,
    activeCalendar, activeCalendarMonths, activeCalendarEras, maxDaysInCurrentMonth, ...helpers,
    setCalendar, onDateFieldsChange, onUniversalDateChange, shiftByMinutes, shiftByPreset, applyTimeOfDay,
    setPrecision, onSeasonChange, toggleApproximate, toggleDatePicker, syncInitialTimelineDate
  };
}
