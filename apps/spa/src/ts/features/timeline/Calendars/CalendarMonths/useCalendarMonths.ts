import { ref } from 'vue';

export function useCalendarMonths(props: any, _emit?: any) {
  const isCollapsed = ref(false);

  const moveItem = (idx: number, delta: number) => {
    const arr = props.modelValue.месяцы;
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
