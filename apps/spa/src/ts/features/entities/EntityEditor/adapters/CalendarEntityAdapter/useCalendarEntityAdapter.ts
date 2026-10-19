import { ref } from 'vue';
import type { CalendarRecord } from '@/stores/calendar.store';
import type {
  CalendarEntityAdapterProps,
  CalendarEntityAdapterEmits,
} from './CalendarEntityAdapter.model';

export function useCalendarEntityAdapter(
  _props: CalendarEntityAdapterProps,
  emit: CalendarEntityAdapterEmits
) {
  const currentCalendarRecord = ref<CalendarRecord | null>(null);

  function onCalendarUpdate(calendar: CalendarRecord) {
    currentCalendarRecord.value = calendar;
    const serializable: Record<string, unknown> = {
      id: calendar.id,
      name: calendar.name,
      is_master: calendar.is_master,
      is_default: calendar.is_default,
      ...(calendar.data || {}),
    };
    emit('update:modelValue', serializable);
    emit('modified');
  }

  function onCalendarSave(calendar: CalendarRecord) {
    currentCalendarRecord.value = calendar;
    emit('save', calendar);
  }

  return {
    currentCalendarRecord,
    onCalendarUpdate,
    onCalendarSave,
  };
}
