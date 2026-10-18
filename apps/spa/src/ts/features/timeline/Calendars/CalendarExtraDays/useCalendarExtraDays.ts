/**
 * @file useCalendarExtraDays.ts
 * @description Логика управления эпагоменами (днями вне месяцев) и заморозкой недели.
 */

import { computed, ref } from 'vue';
import type { CalendarExtraDaysProps, CalendarExtraDaysEmits } from './CalendarExtraDays.model';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface EpagomenalConfig {
  extra_days_base: number;
  extra_days_leap: number;
  pause_on_extra_days: boolean;
  name: string;
}

export function useCalendarExtraDays(
  props: CalendarExtraDaysProps,
  emit: CalendarExtraDaysEmits
) {
  const isCollapsed = ref(false);

  const extraDaysConfig = computed((): EpagomenalConfig => {
    const data = props.modelValue as CalendarData & { epagomenal_config?: EpagomenalConfig };
    if (!data.epagomenal_config) {
      data.epagomenal_config = {
        extra_days_base: 0,
        extra_days_leap: 0,
        pause_on_extra_days: false,
        name: 'Праздничные дни',
      };
    }
    return data.epagomenal_config;
  });

  const baseDays = computed({
    get: () => extraDaysConfig.value.extra_days_base || 0,
    set: (val: number) => {
      extraDaysConfig.value.extra_days_base = Math.max(0, val);
      props.modelValue.extra_days = extraDaysConfig.value.extra_days_base;
      if (props.modelValue.extra_days_config) {
        props.modelValue.extra_days_config.base_days = extraDaysConfig.value.extra_days_base;
      }
      emit('update:modelValue', props.modelValue);
    },
  });

  const leapDays = computed({
    get: () => extraDaysConfig.value.extra_days_leap || 0,
    set: (val: number) => {
      extraDaysConfig.value.extra_days_leap = Math.max(0, val);
      if (props.modelValue.extra_days_config) {
        props.modelValue.extra_days_config.leap_days = extraDaysConfig.value.extra_days_leap;
      }
      emit('update:modelValue', props.modelValue);
    },
  });

  const pauseWeek = computed({
    get: () => extraDaysConfig.value.pause_on_extra_days || false,
    set: (val: boolean) => {
      extraDaysConfig.value.pause_on_extra_days = val;
      props.modelValue.pause_weekdays_on_extra_days = val;
      if (props.modelValue.extra_days_config) {
        props.modelValue.extra_days_config.pause_weekdays = val;
      }
      emit('update:modelValue', props.modelValue);
    },
  });

  const name = computed({
    get: () => extraDaysConfig.value.name || 'Праздничные дни',
    set: (val: string) => {
      extraDaysConfig.value.name = val;
      emit('update:modelValue', props.modelValue);
    },
  });

  return {
    isCollapsed,
    baseDays,
    leapDays,
    pauseWeek,
    name,
  };
}
