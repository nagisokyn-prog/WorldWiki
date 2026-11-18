import { computed } from 'vue';
import type { Tab2ErasSectionProps } from './Tab2ErasSection.model';

/** Вычисляет опции XboxWheel для выбора месяца годовщины эры. */
export function useTab2ErasSection(props: Tab2ErasSectionProps) {
  const monthWheelOptions = computed(() =>
    props.months.map((m, mIdx) => ({
      value: mIdx,
      label: m.название || `Месяц ${mIdx + 1}`,
    }))
  );

  return {
    monthWheelOptions,
  };
}
