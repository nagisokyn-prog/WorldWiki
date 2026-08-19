import { ref } from 'vue';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface CalendarWeekdaysProps {
  modelValue: Partial<CalendarData> & { названия_дней_недели?: string[]; [key: string]: unknown };
}

export function useCalendarWeekdays(props: CalendarWeekdaysProps, _emit?: (event: string, ...args: unknown[]) => void) {
  const isCollapsed = ref(false);

  const moveItem = (idx: number, delta: number) => {
    const arr = props.modelValue.названия_дней_недели;
    const n = idx + delta;
    if (n >= 0 && n < arr.length) {
      [arr[idx], arr[n]] = [arr[n], arr[idx]];
    }
  };

  const addDay = () => {
    if (!props.modelValue.названия_дней_недели) props.modelValue.названия_дней_недели = [];
    props.modelValue.названия_дней_недели.push(
      `День ${props.modelValue.названия_дней_недели.length + 1}`,
    );
  };

  const updateDay = (idx: number, val: string) => {
    if (props.modelValue.названия_дней_недели) {
      props.modelValue.названия_дней_недели[idx] = val;
    }
  };

  const removeDay = (idx: number) => {
    if (props.modelValue.названия_дней_недели) {
      props.modelValue.названия_дней_недели.splice(idx, 1);
    }
  };

  return {
    isCollapsed,
    moveItem,
    addDay,
    updateDay,
    removeDay
  };
}
