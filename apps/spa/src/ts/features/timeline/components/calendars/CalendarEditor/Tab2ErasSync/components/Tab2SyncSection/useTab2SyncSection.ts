import { computed, ref } from 'vue';
import type { Tab2SyncSectionProps } from './Tab2SyncSection.model';

export function useTab2SyncSection(props?: Tab2SyncSectionProps) {
  const isCollapsed = ref(false);

  const masterMonthWheelOptions = computed(() =>
    (props?.masterMonths || []).map((m, idx) => ({
      value: idx,
      label: m.название || `Месяц ${idx + 1}`,
    }))
  );

  return {
    isCollapsed,
    masterMonthWheelOptions,
  };
}
