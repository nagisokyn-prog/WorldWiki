import { ref, computed, onMounted } from 'vue';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';

import type { CalendarRecord } from '../../../../stores/calendar.store';

export function useGlobalCalendarWidget(props: { project: string }) {
  const masterCalendar = ref<CalendarRecord | null>(null);
  const localCalendars = ref<CalendarRecord[]>([]);

  const selectedLocalCal = ref<string | null>(null);

  const currentMasterInput = ref({
    era_index: 0,
    year: 1,
    month: 0,
    day: 1,
    hour: 12,
    minute: 0
  });

  const loadCalendars = async () => {
    const list = await useCalendarStore().getCalendars(props.project);
    masterCalendar.value = list.find(c => c.is_master) || null;
    localCalendars.value = list.filter(c => !c.is_master);
  };

  onMounted(() => {
    loadCalendars();
  });

  const currentAbsoluteMinute = computed(() => {
    if (!masterCalendar.value?.data) return 0;
    return CalendarMath.getAbsoluteMinute(currentMasterInput.value, masterCalendar.value.data);
  });

  const formattedMasterDate = computed(() => {
    if (!masterCalendar.value?.data) return '';
    const dateObj = { 
      absolute_minute: currentAbsoluteMinute.value,
      calendar_id: masterCalendar.value.id || '',
      original_input: currentMasterInput.value
    };
    return CalendarMath.formatDate(masterCalendar.value.data, dateObj);
  });

  const formattedLocalDate = computed(() => {
    if (!selectedLocalCal.value) return '';
    const localCal = localCalendars.value.find(c => c.id === selectedLocalCal.value);
    if (!localCal?.data) return '';
    
    const localInput = CalendarMath.getDateFromAbsolute(currentAbsoluteMinute.value, localCal.data, 0);
    
    const dateObj = {
      absolute_minute: currentAbsoluteMinute.value,
      calendar_id: localCal.id || '',
      original_input: localInput
    };
    
    return CalendarMath.formatDate(localCal.data, dateObj);
  });

  return {
    masterCalendar,
    localCalendars,
    selectedLocalCal,
    currentMasterInput,
    formattedMasterDate,
    formattedLocalDate
  };
}
