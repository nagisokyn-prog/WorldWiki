import { ref, computed } from 'vue';
import type { Tab1ExtraDaysTapeProps } from './Tab1ExtraDaysTape.model';

export const PLACEMENT_OPTIONS = [
  { value: 'end_of_year', label: 'В конце года (после всех месяцев)' },
  { value: 'mid_year', label: 'В середине года (как у Толкина)' },
  { value: 'start_of_year', label: 'В начале года (перед 1-м месяцем)' },
  { value: 'after_month', label: 'После конкретного месяца...' },
] as const;

export function useTab1ExtraDaysTape(props: Tab1ExtraDaysTapeProps) {
  const isCollapsed = ref(props.extraDaysCount === 0);

  const placementOptions = PLACEMENT_OPTIONS;

  const monthOptions = computed(() =>
    props.months.map((m, idx) => ({
      value: String(idx),
      label: m.название || `Месяц ${idx + 1}`,
    }))
  );

  const toggleCollapsed = () => {
    isCollapsed.value = !isCollapsed.value;
  };

  return {
    isCollapsed,
    placementOptions,
    monthOptions,
    toggleCollapsed,
  };
}
