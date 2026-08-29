import { ref, watch } from 'vue';
import type { CalendarData, CalendarEra } from '../../../../services/Calendars/calendar.types';

export interface CalendarErasProps {
  modelValue: Partial<CalendarData> & { эпохи?: CalendarEra[]; [key: string]: unknown };
}

export function useCalendarEras(props: CalendarErasProps, _emit?: (event: string, ...args: unknown[]) => void) {
  const isCollapsed = ref(false);

  const moveItem = (idx: number, delta: number) => {
    const arr = props.modelValue.эпохи;
    if (!arr) return;
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

  const onNameInput = (era: CalendarEra, e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    era.название = val;
    era.name = val;
  };

  watch(
    () => props.modelValue?.эпохи,
    (eras) => {
      if (eras && Array.isArray(eras)) {
        eras.forEach((e) => {
          if (!e.название && e.name) {
            e.название = e.name;
          }
          if (!e.name && e.название) {
            e.name = e.название;
          }
        });
      }
    },
    { immediate: true, deep: true }
  );

  return {
    isCollapsed,
    moveItem,
    addEra,
    removeEra,
    onNameInput,
  };
}
