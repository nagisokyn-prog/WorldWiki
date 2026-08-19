import { ref } from 'vue';
import type { CalendarData, CalendarEra } from '../../../../services/Calendars/calendar.types';

export interface CalendarErasProps {
  modelValue: Partial<CalendarData> & { эпохи?: CalendarEra[]; [key: string]: unknown };
}

export function useCalendarEras(props: CalendarErasProps, _emit?: (event: string, ...args: unknown[]) => void) {
  const isCollapsed = ref(false);

  const moveItem = (idx: number, delta: number) => {
    const arr = props.modelValue.эпохи;
    const n = idx + delta;
    if (n >= 0 && n < arr.length) {
      [arr[idx], arr[n]] = [arr[n], arr[idx]];
    }
  };

  const addEra = () => {
    if (!props.modelValue.эпохи) props.modelValue.эпохи = [];
    const last = props.modelValue.эпохи[props.modelValue.эпохи.length - 1]?.год_конца || 0;
    props.modelValue.эпохи.push({
      название: `Эпоха ${props.modelValue.эпохи.length + 1}`,
      год_начала: last + 1,
      год_конца: last + 1000,
      обратный_отсчет: false,
    });
  };

  const removeEra = (idx: number) => {
    if (props.modelValue.эпохи) {
      props.modelValue.эпохи.splice(idx, 1);
    }
  };

  return {
    isCollapsed,
    moveItem,
    addEra,
    removeEra
  };
}
