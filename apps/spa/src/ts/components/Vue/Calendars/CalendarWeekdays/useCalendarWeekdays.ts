import { ref } from 'vue';

export function useCalendarWeekdays(props: any, emit?: any) {
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

  return {
    isCollapsed,
    moveItem,
    addDay
  };
}
