import { ref, computed } from 'vue';
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
    const idx = props.modelValue.месяцы.length;
    props.modelValue.месяцы.push({
      название: `Месяц ${idx + 1}`,
      дней: 30
    });
  };

  const removeMonth = (idx: number) => {
    if (props.modelValue.месяцы) {
      props.modelValue.месяцы.splice(idx, 1);
    }
  };

  const totalMonthsDays = computed(() => {
    return (props.modelValue.месяцы || []).reduce((acc, m) => acc + (Number(m.дней) || 0), 0);
  });

  const targetYearDays = computed(() => {
    const target = props.modelValue.дней_в_году ?? (props.modelValue as { days_in_year?: number }).days_in_year;
    return typeof target === 'number' && target > 0 ? target : null;
  });

  const daysBalanceText = computed(() => {
    const sum = totalMonthsDays.value;
    const target = targetYearDays.value;
    if (target === null) {
      return `${sum} дн`;
    }
    if (sum === target) {
      return `✓ ${sum} / ${target} дн`;
    }
    if (sum < target) {
      return `⚠️ ${sum} / ${target} дн (-${target - sum})`;
    }
    return `⚠️ ${sum} / ${target} дн (+${sum - target})`;
  });

  const daysBalanceClass = computed(() => {
    const sum = totalMonthsDays.value;
    const target = targetYearDays.value;
    if (target === null) {
      return 'balance-neutral';
    }
    return sum === target ? 'balance-ok' : 'balance-warn';
  });

  return {
    isCollapsed,
    moveItem,
    addMonth,
    removeMonth,
    totalMonthsDays,
    targetYearDays,
    daysBalanceText,
    daysBalanceClass
  };
}
