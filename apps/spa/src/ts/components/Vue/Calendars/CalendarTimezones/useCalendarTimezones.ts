import { computed } from 'vue';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export function useCalendarTimezones(props: { modelValue: CalendarData }, emit: any) {
  const timezoneRegions = computed(() => props.modelValue.timezone_regions || []);

  const updateParent = () => {
    emit('update:modelValue', { ...props.modelValue, timezone_regions: timezoneRegions.value });
  };

  const addTz = () => {
    const tzs = [...timezoneRegions.value];
    tzs.push({
      id: 'tz_' + Date.now(),
      name: 'Новый регион',
      offset_minutes: 0
    });
    emit('update:modelValue', { ...props.modelValue, timezone_regions: tzs });
  };

  const removeTz = (idx: number) => {
    const tzs = [...timezoneRegions.value];
    tzs.splice(idx, 1);
    emit('update:modelValue', { ...props.modelValue, timezone_regions: tzs });
  };

  return {
    timezoneRegions,
    updateParent,
    addTz,
    removeTz
  };
}
