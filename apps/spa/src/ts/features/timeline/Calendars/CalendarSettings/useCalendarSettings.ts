import { computed, watch, ref } from 'vue';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface CalendarSettingsProps {
  modelValue: CalendarData;
  isMaster?: boolean;
}

export function useCalendarSettings(props: CalendarSettingsProps, emit: (event: 'update:modelValue', val: CalendarData) => void) {
  const isCollapsed = ref(false);

  const calendar = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  });

  // Initialize defaults if they don't exist
  if (!calendar.value.настройки_времени) {
    calendar.value.настройки_времени = {
      часов_в_сутках: 24,
      минут_в_часе: 60,
      секунд_в_минуте: 60,
      широта: 45,
      учитывать_сезонную_длительность_дня: false
    };
  }

  const defaultSettings = {
    часов_в_сутках: 24,
    минут_в_часе: 60,
    секунд_в_минуте: 60,
    широта: 45,
    учитывать_сезонную_длительность_дня: false
  };

  const settings = computed(() => calendar.value.настройки_времени || defaultSettings);

  watch(() => settings.value.учитывать_сезонную_длительность_дня, (val) => {
    if (val && !calendar.value.day_length_anchor) {
      calendar.value.day_length_anchor = {
        summer_solstice_hours: 16.0,
        winter_solstice_hours: 8.0
      };
    }
  });

  const dayLengthAnchor = computed(() => calendar.value.day_length_anchor);

  return {
    isCollapsed,
    settings,
    dayLengthAnchor
  };
}
