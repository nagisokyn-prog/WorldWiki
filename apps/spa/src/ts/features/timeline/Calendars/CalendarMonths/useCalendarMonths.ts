import { ref } from 'vue';
import type { CalendarData, CalendarMonth } from '../../../../services/Calendars/calendar.types';

export interface CalendarMonthsProps {
  modelValue: Partial<CalendarData> & { месяцы?: CalendarMonth[]; [key: string]: unknown };
}

export function useCalendarMonths(props: CalendarMonthsProps, _emit?: (event: string, ...args: unknown[]) => void) {
  const isCollapsed = ref(false);

  const moveItem = (idx: number, delta: number) => {
    const arr = props.modelValue.месяцы;
    if (!arr) return;
    const n = idx + delta;
    if (n >= 0 && n < arr.length) {
      [arr[idx], arr[n]] = [arr[n], arr[idx]];
    }
  };

  const addMonth = () => {
    if (!props.modelValue.месяцы) props.modelValue.месяцы = [];
    props.modelValue.месяцы.push({
      название: `Месяц ${props.modelValue.месяцы.length + 1}`,
      дней: 30,
    });
  };

  const removeMonth = (idx: number) => {
    if (props.modelValue.месяцы) {
      props.modelValue.месяцы.splice(idx, 1);
    }
  };

  return {
    isCollapsed,
    moveItem,
    addMonth,
    removeMonth
  };
}
