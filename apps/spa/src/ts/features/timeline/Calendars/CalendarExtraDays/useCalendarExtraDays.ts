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
        name: 'Эпагомены',
      };
    }
    return data.epagomenal_config;
  });

  const baseDays = computed({
    get: () => extraDaysConfig.value.extra_days_base || 0,
    set: (val: number) => {
      extraDaysConfig.value.extra_days_base = Math.max(0, val);
      emit('update:modelValue', props.modelValue);
    },
  });

  const leapDays = computed({
    get: () => extraDaysConfig.value.extra_days_leap || 0,
    set: (val: number) => {
      extraDaysConfig.value.extra_days_leap = Math.max(0, val);
      emit('update:modelValue', props.modelValue);
    },
  });

  const pauseWeek = computed({
    get: () => extraDaysConfig.value.pause_on_extra_days || false,
    set: (val: boolean) => {
      extraDaysConfig.value.pause_on_extra_days = val;
      emit('update:modelValue', props.modelValue);
    },
  });

  const name = computed({
    get: () => extraDaysConfig.value.name || 'Эпагомены',
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
