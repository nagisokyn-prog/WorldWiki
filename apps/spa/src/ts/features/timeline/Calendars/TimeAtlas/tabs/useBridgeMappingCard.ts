import { computed } from 'vue';
import type { CalendarDate } from '../../../../../services/Calendars/calendar.types';
import type { BridgeMappingCardProps } from './BridgeMappingCard.model';

export function useBridgeMappingCard(props: BridgeMappingCardProps) {
  const safeDate = computed<NonNullable<CalendarDate['original_input']>>(() => {
    return props.localDate || {
      era_index: 0,
      year: 1,
      month: 0,
      day: 1,
      hour: 0,
      minute: 0
    };
  });

  return {
    safeDate
  };
}

