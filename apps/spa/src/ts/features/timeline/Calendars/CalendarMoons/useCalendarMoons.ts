import { computed, ref } from 'vue';

export function useCalendarMoons(props: any, emit: any) {
  const isCollapsed = ref(false);

  const calendar = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  });

  const addMoon = () => {
    if (!calendar.value.moons) calendar.value.moons = [];
    calendar.value.moons.push({
      name: `Луна ${calendar.value.moons.length + 1}`,
      period_days: 28,
      initial_phase: 0,
      phase_names: {
        new: 'Новолуние',
        waxing: 'Растущая',
        full: 'Полнолуние',
        waning: 'Убывающая'
      }
    });
  };

  const moveItem = (arr: any[], idx: number, dir: number) => {
    if (!arr) return;
    if (idx + dir < 0 || idx + dir >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[idx + dir];
    arr[idx + dir] = temp;
  };

  return {
    isCollapsed,
    calendar,
    addMoon,
    moveItem
  };
}
