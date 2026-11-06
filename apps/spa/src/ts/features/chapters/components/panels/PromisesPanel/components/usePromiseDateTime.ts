import { ref, computed, type Ref } from 'vue';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData, CalendarMonth, CalendarEra } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { DatePickerModelValue } from '@/shared/ui/UniversalDatePicker/useUniversalDatePicker';
import type { TimelineEventOption } from './PromiseCardMeta/PromiseCardMeta.model';
import { usePromiseDateHelpers } from './usePromiseDateHelpers';

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

  const {
    eraWheelOptions,
    yearWheelOptions,
    monthWheelOptions,
    dayWheelOptions,
    hourWheelOptions,
    minuteWheelOptions,
    diegeticInfo,
    eraMinYear,
    eraMaxYear
  } = usePromiseDateHelpers(
    activeCalendar,
    activeCalendarMonths,
    activeCalendarEras,
    maxDaysInCurrentMonth,
    currentYear,
    currentEraIdx,
    currentMonthIdx,
    currentDay,
    currentHour,
    currentMinute,
    getCalendarData
  );

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

  const syncModelFromMabs = (mAbs: number, cal: CalendarRecord, explicitEraIdx?: number) => {
    const calData = getCalendarData(cal);
    if (!calData) return;

    const isEventBCE = mAbs < 0;
    const baseEraIdx = calData.эпохи && calData.эпохи.length > 0
      ? Math.max(0, calData.эпохи.findIndex((e) => !!e.обратный_отсчет === isEventBCE))
      : 0;

    // Сначала рассчитываем дату в базовой шкале соответствующего направления (до н.э. / н.э.)
    const rawDate = CalendarMath.getDateFromAbsolute(mAbs, calData, baseEraIdx);

    // Определяем эру: явный индекс или поиск эры, чей диапазон [год_начала, год_конца] включает rawDate.year
    let resolvedEraIdx = baseEraIdx;
    if (explicitEraIdx !== undefined && calData.эпохи && explicitEraIdx >= 0 && explicitEraIdx < calData.эпохи.length) {
      resolvedEraIdx = explicitEraIdx;
    } else if (calData.эпохи && calData.эпохи.length > 0) {
      // 1. Приоритетный поиск: строгое совпадение направления отсчета (до н.э. против н.э.) и диапазона лет
      let matched = calData.эпохи.findIndex((era) => {
        const isEraBCE = !!era.обратный_отсчет;
        if (isEraBCE !== isEventBCE) return false;
        const start = era.год_начала ?? 1;
        const end = era.год_конца ?? Infinity;
        return rawDate.year >= start && rawDate.year <= end;
      });

      // 2. Если строгого совпадения по направлению нет, мягкий fallback
      if (matched === -1) {
        matched = calData.эпохи.findIndex((era) => {
          const start = era.год_начала ?? 1;
          const end = era.год_конца ?? Infinity;
          return rawDate.year >= start && rawDate.year <= end;
        });
      }

      if (matched !== -1) {
        resolvedEraIdx = matched;
      }
    }

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

  const setCalendar = (calId: string) => {
    if (!calId || currentCalendarId.value === calId) return;
    currentCalendarId.value = calId;
    onDateFieldsChange();
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

  const syncInitialTimelineDate = (
    itemData?: {
      date_fields?: { era_index?: number; year?: number; month?: number; day?: number; hour?: number; minute?: number } | null;
      m_abs?: number | null;
      calendar_id?: string | null;
      timeline_event_id?: string | null;
    } | null,
    timelineEventId?: string | null,
    eventsList: TimelineEventOption[] = []
  ) => {
    if (itemData?.calendar_id) {
      currentCalendarId.value = itemData.calendar_id;
    }

    if (itemData?.date_fields) {
      syncStateFromInput(itemData.date_fields, itemData.calendar_id || undefined);
      return;
    }

    const explicitEra = itemData?.date_fields?.era_index;

    if (itemData?.m_abs !== undefined && itemData.m_abs !== null && calendars.value.length > 0) {
      const cal = (itemData.calendar_id && calendars.value.find(c => c.id === itemData.calendar_id)) || activeCalendar.value || calendars.value[0];
      if (cal) {
        syncModelFromMabs(itemData.m_abs, cal, explicitEra);
        return;
      }
    }

    const tid = itemData?.timeline_event_id || timelineEventId;
    if (tid) {
      const ev = eventsList.find(e => e.id === tid);
      if (ev && ev.m_abs !== undefined && calendars.value.length > 0) {
        const cal = activeCalendar.value || calendars.value[0];
        if (cal) syncModelFromMabs(ev.m_abs, cal, explicitEra);
        return;
      }
    }

    if (calendars.value.length > 0) {
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
    eraMinYear,
    eraMaxYear,
    diegeticInfo,
    setCalendar,
    onDateFieldsChange,
    onUniversalDateChange,
    toggleDatePicker,
    syncInitialTimelineDate
  };
}
