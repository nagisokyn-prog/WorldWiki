import { computed } from 'vue';
import type { CalendarDate } from '@/services/Calendars/calendar.types';
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

  const eraWheelOptions = computed(() =>
    (props.calData?.эпохи || []).map((era, eIdx) => ({
      value: eIdx,
      label: era.название || `Эпоха ${eIdx + 1}`,
    }))
  );

  const monthWheelOptions = computed(() =>
    (props.calData?.месяцы || []).map((m, mIdx) => ({
      value: mIdx,
      label: m.название || (m as unknown as { name?: string }).name || `Месяц ${mIdx + 1}`,
    }))
  );

  const toSelectEvent = (value: string): Event => ({ target: { value } } as unknown as Event);

  return {
    safeDate,
    eraWheelOptions,
    monthWheelOptions,
    toSelectEvent,
  };
}

