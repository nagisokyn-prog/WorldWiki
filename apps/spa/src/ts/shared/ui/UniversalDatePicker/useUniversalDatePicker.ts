import { ref, watch, onMounted } from 'vue';
import { useCalendarStore } from '@/stores/calendar.store';
import type { CalendarRecord } from '@/stores/calendar.store';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { settingsService } from '@worldwiki/components';
import type { AppSettings } from '@worldwiki/components';
import { useDatePickerOptions } from './useDatePickerOptions';
import { useDatePickerSync } from './useDatePickerSync';

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

  const isHourHidden = ref(false);
  const isMinuteHidden = ref(false);

  const restoreTime = () => {
    isHourHidden.value = false;
    isMinuteHidden.value = false;
  };

  const {
    calendar,
    calendarOptions,
    eras,
    months,
    currentEra,
    yearInputMode,
    timeSettings,
    eraOptions,
    yearOptions,
    monthOptions,
    maxDaysInMonth,
    dayOptions,
    hourOptions,
    minuteOptions
  } = useDatePickerOptions(allCalendars, currentCalendarId, currentEraIdx, currentYear, currentMonthIdx);

  const {
    syncFromProps,
    onCalendarChange,
    onEraChange,
    onYearChange,
    onMonthChange,
    onDayChange,
    onTimeChange
  } = useDatePickerSync(
    props,
    emit,
    allCalendars,
    currentCalendarId,
    currentEraIdx,
    currentYear,
    currentMonthIdx,
    currentDay,
    currentHour,
    currentMinute,
    calendar,
    eras,
    months,
    currentEra,
    maxDaysInMonth,
    timeSettings
  );

  onMounted(async () => {
    try {
      const list = await useCalendarStore().getCalendars(props.project);
      allCalendars.value = list && list.length > 0 ? list : [{ id: 'temp', is_default: true, data: CalendarMath.getDefaultCalendar() }];
    } catch {
      allCalendars.value = [{ id: 'temp', is_default: true, data: CalendarMath.getDefaultCalendar() }];
    }

    syncFromProps();

    settingsService.onChange((s: AppSettings) => {
      wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal';
    });
  });

  watch(
    () => {
      const val = props.modelValue;
      if (!val || typeof val !== 'object') return null;
      return [
        val.calendar_id,
        val.original_input?.era_index,
        val.original_input?.year,
        val.original_input?.month,
        val.original_input?.day,
        val.original_input?.hour,
        val.original_input?.minute,
        val.эпоха_ключ,
        val.год,
        val.месяц,
        val.день
      ];
    },
    () => {
      const val = props.modelValue;
      if (!val || typeof val !== 'object') return;
      if (val.calendar_id && val.original_input) {
        if (
          val.calendar_id !== currentCalendarId.value ||
          val.original_input.era_index !== currentEraIdx.value ||
          val.original_input.year !== currentYear.value ||
          val.original_input.month !== currentMonthIdx.value ||
          val.original_input.day !== currentDay.value ||
          (props.showTime && val.original_input.hour !== currentHour.value) ||
          (props.showTime && val.original_input.minute !== currentMinute.value)
        ) {
          syncFromProps();
        }
      } else if (val.эпоха_ключ !== undefined) {
        syncFromProps(true);
      }
    }
  );

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
    isHourHidden,
    isMinuteHidden,
    restoreTime,
    onCalendarChange,
    onEraChange,
    onYearChange,
    onMonthChange,
    onDayChange,
    onTimeChange
  };
}
