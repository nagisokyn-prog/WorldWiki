import { computed } from 'vue';
import type { Tab1LeapRulesInspectorProps } from './Tab1LeapRulesInspector.model';

/** Вычисляет опции XboxWheel для инспектора високосных правил. */
export function useTab1LeapRulesInspector(props: Tab1LeapRulesInspectorProps) {
  const monthWheelOptions = computed(() =>
    props.months.map((m, idx) => ({
      value: idx,
      label: `${idx + 1}. ${m.название || `Месяц ${idx + 1}`}`,
    }))
  );

  return {
    monthWheelOptions,
  };
}
