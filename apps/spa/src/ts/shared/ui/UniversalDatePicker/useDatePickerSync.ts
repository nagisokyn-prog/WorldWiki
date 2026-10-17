import type { Ref, ComputedRef } from 'vue';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData, CalendarEra, CalendarMonth } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { UniversalDatePickerProps } from './useUniversalDatePicker';

export function useDatePickerSync(
  props: UniversalDatePickerProps,
  emit: (event: 'update:modelValue', value: unknown) => void,
  allCalendars: Ref<CalendarRecord[]>,
  currentCalendarId: Ref<string>,
  currentEraIdx: Ref<number>,
  currentYear: Ref<number>,
  currentMonthIdx: Ref<number>,
  currentDay: Ref<number>,
  currentHour: Ref<number>,
  currentMinute: Ref<number>,
  calendar: ComputedRef<CalendarData | null>,
  eras: ComputedRef<CalendarEra[]>,
  months: ComputedRef<CalendarMonth[]>,
  currentEra: ComputedRef<CalendarEra>,
  maxDaysInMonth: ComputedRef<number>,
  timeSettings: ComputedRef<{ часов_в_сутках: number; минут_в_часе: number }>
) {
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
      era_index: Number(currentEraIdx.value) || 0,
      year: Number(currentYear.value) || 1,
      month: Number(currentMonthIdx.value) || 0,
      day: Number(currentDay.value) || 1
    };

    if (props.showTime) {
      original_input.hour = Number(currentHour.value) || 0;
      original_input.minute = Number(currentMinute.value) || 0;
    }

    const absolute_minute = CalendarMath.getAbsoluteMinute(original_input, calendar.value);

    emit('update:modelValue', {
      absolute_minute,
      calendar_id: currentCalendarId.value,
      original_input
    });
  };

  const validateValues = (emitIfChanged = false) => {
    if (!calendar.value) return;
    let changed = false;

    if (currentEraIdx.value < 0 || currentEraIdx.value >= eras.value.length) {
      currentEraIdx.value = 0;
      changed = true;
    }

    if (currentYear.value < currentEra.value.год_начала) {
      currentYear.value = currentEra.value.год_начала;
      changed = true;
    }
    if (currentYear.value > currentEra.value.год_конца) {
      currentYear.value = currentEra.value.год_конца;
      changed = true;
    }

    if (currentMonthIdx.value < 0 || currentMonthIdx.value >= months.value.length) {
      currentMonthIdx.value = 0;
      changed = true;
    }

    const max = maxDaysInMonth.value;
    if (currentDay.value < 1) {
      currentDay.value = 1;
      changed = true;
    }
    if (currentDay.value > max) {
      currentDay.value = max;
      changed = true;
    }

    if (currentHour.value < 0 || currentHour.value >= timeSettings.value.часов_в_сутках) {
      currentHour.value = 0;
      changed = true;
    }
    if (currentMinute.value < 0 || currentMinute.value >= timeSettings.value.минут_в_часе) {
      currentMinute.value = 0;
      changed = true;
    }

    if (changed && emitIfChanged) emitUpdate();
  };

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
      } else if (val.calendar_id && val.original_input) {
        currentCalendarId.value = val.calendar_id;
        currentEraIdx.value = Number(val.original_input.era_index) || 0;
        currentYear.value = Number(val.original_input.year) || currentEra.value.год_начала;
        currentMonthIdx.value = Number(val.original_input.month) || 0;
        currentDay.value = Number(val.original_input.day) || 1;
        currentHour.value = val.original_input.hour !== undefined ? Number(val.original_input.hour) : Math.floor(timeSettings.value.часов_в_сутках / 2);
        currentMinute.value = val.original_input.minute !== undefined ? Number(val.original_input.minute) : 0;
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

  return {
    syncFromProps,
    validateValues,
    emitUpdate,
    onCalendarChange,
    onEraChange,
    onYearChange,
    onMonthChange,
    onDayChange,
    onTimeChange
  };
}
