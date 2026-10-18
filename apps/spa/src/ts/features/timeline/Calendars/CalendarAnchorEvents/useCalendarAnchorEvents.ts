/**
 * @file useCalendarAnchorEvents.ts
 * @description Composable для управления опорными историческими событиями (вехами мира).
 */

import { ref, computed } from 'vue';
import type { CalendarAnchorEventsProps, CalendarAnchorEventsEmits } from './CalendarAnchorEvents.model';
import type { CalendarAnchorEvent } from '../../../../services/Calendars/calendar.types';

export function useCalendarAnchorEvents(props: CalendarAnchorEventsProps, emit?: CalendarAnchorEventsEmits) {
  const isCollapsed = ref(false);

  const anchorEvents = computed<CalendarAnchorEvent[]>({
    get: () => props.modelValue.anchor_events || [],
    set: (val) => {
      emit?.('update:modelValue', {
        ...props.modelValue,
        anchor_events: val
      });
    }
  });

  const addEvent = () => {
    const list = [...anchorEvents.value];
    const newId = 'evt_' + Date.now();
    list.push({
      id: newId,
      name: `Опорное событие ${list.length + 1}`,
      year: 0,
      month: 0,
      day: 1
    });
    props.modelValue.anchor_events = list;
    anchorEvents.value = list;
  };

  const removeEvent = (idx: number) => {
    const list = [...anchorEvents.value];
    list.splice(idx, 1);
    props.modelValue.anchor_events = list;
    anchorEvents.value = list;
  };

  const moveItem = (idx: number, delta: number) => {
    const list = [...anchorEvents.value];
    const n = idx + delta;
    if (n >= 0 && n < list.length) {
      [list[idx], list[n]] = [list[n], list[idx]];
      props.modelValue.anchor_events = list;
      anchorEvents.value = list;
    }
  };

  return {
    isCollapsed,
    anchorEvents,
    addEvent,
    removeEvent,
    moveItem
  };
}
