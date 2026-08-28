import { ref, computed, watch, onMounted } from 'vue';
import { useCalendarStore } from '../../../stores/calendar.store';
import type { CalendarRecord } from '../../../stores/calendar.store';
import { CalendarMath } from '../../../services/Calendars/calendar.math';
import type { CalendarData, CalendarEra, CalendarMonth } from '../../../services/Calendars/calendar.types';
import { settingsService } from '@worldwiki/components';
import type { AppSettings } from '@worldwiki/components';

export interface DatePickerModelValue {
  calendar_id?: string;
  absolute_minute?: number;
  original_input?: {
    era_index: number;
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  };
  эпоха_ключ?: number;
  год?: number;
  месяц?: number;
  день?: number;
  [key: string]: unknown;
}

export interface UniversalDatePickerProps {
  project: string;
  modelValue?: DatePickerModelValue | string | null;
  showTime?: boolean;
  [key: string]: unknown;
}

export function useUniversalDatePicker(props: UniversalDatePickerProps, emit: (event: 'update:modelValue', value: unknown) => void) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

  const allCalendars = ref<CalendarRecord[]>([]);

  const currentCalendarId = ref('');
  const currentEraIdx = ref(0);
  const currentYear = ref(1);
  const currentMonthIdx = ref(0);
  const currentDay = ref(1);
  const currentHour = ref(12);
  const currentMinute = ref(0);

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
  const yearInputMode = computed(() => yearRange.value > 500);

  const timeSettings = computed(() => calendar.value?.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 });

  const eraOptions = computed(() => {
    return eras.value.map((e: CalendarEra, i: number) => ({ value: i, label: e.название || `Эпоха ${i+1}` }));
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
    return months.value.map((m: CalendarMonth, i: number) => ({ value: i, label: m.название || `Месяц ${i+1}` }));
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

  const syncFromProps = (emitIfChanged = false) => {
    const val = props.modelValue;
    if (val && typeof val === 'object') {
      if (val.эпоха_ключ !== undefined && !val.calendar_id && !val.original_input) {
        const defaultCal = allCalendars.value.find(c => c.is_default) || allCalendars.value[0];
        currentCalendarId.value = defaultCal?.id || '';
        currentEraIdx.value = val.эпоха_ключ;
        currentYear.value = val.год !== undefined ? val.год : currentEra.value.год_начала;
        currentMonthIdx.value = val.месяц !== undefined ? val.месяц : 0;
        currentDay.value = val.день !== undefined ? val.день : 1;
        currentHour.value = Math.floor(timeSettings.value.часов_в_сутках / 2);
        currentMinute.value = 0;
        emitIfChanged = true;
      } 
      else if (val.calendar_id && val.original_input) {
        currentCalendarId.value = val.calendar_id;
        currentEraIdx.value = val.original_input.era_index;
        currentYear.value = val.original_input.year;
        currentMonthIdx.value = val.original_input.month;
        currentDay.value = val.original_input.day;
        currentHour.value = val.original_input.hour ?? Math.floor(timeSettings.value.часов_в_сутках / 2);
        currentMinute.value = val.original_input.minute ?? 0;
      }
    } else {
      const defaultCal = allCalendars.value.find(c => c.is_default) || allCalendars.value[0];
      currentCalendarId.value = defaultCal?.id || '';
      currentEraIdx.value = 0;
      currentYear.value = currentEra.value.год_начала;
      currentMonthIdx.value = 0;
      currentDay.value = 1;
      currentHour.value = Math.floor(timeSettings.value.часов_в_сутках / 2);
      currentMinute.value = 0;
    }
    validateValues(emitIfChanged);
  };

  const validateValues = (emitIfChanged = false) => {
    if (!calendar.value) return;
    let changed = false;

    if (currentEraIdx.value < 0 || currentEraIdx.value >= eras.value.length) {
      currentEraIdx.value = 0;
      changed = true;
    }

    if (currentYear.value < currentEra.value.год_начала) { currentYear.value = currentEra.value.год_начала; changed = true; }
    if (currentYear.value > currentEra.value.год_конца) { currentYear.value = currentEra.value.год_конца; changed = true; }
    
    if (currentMonthIdx.value < 0 || currentMonthIdx.value >= months.value.length) { currentMonthIdx.value = 0; changed = true; }
    
    const max = maxDaysInMonth.value;
    if (currentDay.value < 1) { currentDay.value = 1; changed = true; }
    if (currentDay.value > max) { currentDay.value = max; changed = true; }

    if (currentHour.value < 0 || currentHour.value >= timeSettings.value.часов_в_сутках) { currentHour.value = 0; changed = true; }
    if (currentMinute.value < 0 || currentMinute.value >= timeSettings.value.минут_в_часе) { currentMinute.value = 0; changed = true; }

    if (changed && emitIfChanged) emitUpdate();
  };

  const emitUpdate = () => {
    if (!calendar.value) return;

    const original_input: {
      era_index: number;
      year: number;
      month: number;
      day: number;
      hour?: number;
      minute?: number;
    } = {
      era_index: currentEraIdx.value,
      year: currentYear.value,
      month: currentMonthIdx.value,
      day: currentDay.value
    };

    if (props.showTime) {
      original_input.hour = currentHour.value;
      original_input.minute = currentMinute.value;
    }

    const absolute_minute = CalendarMath.getAbsoluteMinute(original_input, calendar.value);

    emit('update:modelValue', {
      absolute_minute,
      calendar_id: currentCalendarId.value,
      original_input
    });
  };

  const onCalendarChange = () => {
    validateValues();
    emitUpdate();
  };

  const onEraChange = () => {
    if (currentYear.value < currentEra.value.год_начала || currentYear.value > currentEra.value.год_конца) {
      currentYear.value = currentEra.value.год_начала;
    }
    validateValues();
    emitUpdate();
  };

  const onYearChange = () => {
    validateValues();
    emitUpdate();
  };

  const onMonthChange = () => {
    validateValues();
    emitUpdate();
  };

  const onDayChange = () => {
    validateValues();
    emitUpdate();
  };

  const onTimeChange = () => {
    validateValues();
    emitUpdate();
  };

  onMounted(async () => {
    try {
      const list = await useCalendarStore().getCalendars(props.project);
      allCalendars.value = list && list.length > 0 ? list : [{ id: 'temp', is_default: true, data: CalendarMath.getDefaultCalendar() }];
    } catch {
      allCalendars.value = [{ id: 'temp', is_default: true, data: CalendarMath.getDefaultCalendar() }];
    }
    
    syncFromProps();

    settingsService.onChange((s: AppSettings) => wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal');
  });

  watch(() => props.modelValue, (newVal) => {
    if (!newVal || typeof newVal !== 'object') return;
    if (newVal.calendar_id && newVal.original_input) {
      if (
        newVal.calendar_id !== currentCalendarId.value ||
        newVal.original_input.era_index !== currentEraIdx.value ||
        newVal.original_input.year !== currentYear.value ||
        newVal.original_input.month !== currentMonthIdx.value ||
        newVal.original_input.day !== currentDay.value ||
        (props.showTime && newVal.original_input.hour !== currentHour.value) ||
        (props.showTime && newVal.original_input.minute !== currentMinute.value)
      ) {
        syncFromProps();
      }
    } else if (newVal.эпоха_ключ !== undefined) {
      syncFromProps(true);
    }
  }, { deep: true });

  return {
    allCalendars,
    currentCalendarId,
    currentEraIdx,
    currentYear,
    currentMonthIdx,
    currentDay,
    currentHour,
    currentMinute,
    calendarOptions,
    eraOptions,
    yearOptions,
    monthOptions,
    dayOptions,
    hourOptions,
    minuteOptions,
    currentEra,
    yearInputMode,
    wheelHorizontal,
    onCalendarChange,
    onEraChange,
    onYearChange,
    onMonthChange,
    onDayChange,
    onTimeChange
  };
}
