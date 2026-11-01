import { computed } from 'vue';
import type { Tab5DstTransitionRulesProps } from './Tab5DstTransitionRules.model';

export const OCCURRENCE_OPTIONS = [
  { value: 'first', label: 'Первое' },
  { value: 'second', label: 'Второе' },
  { value: 'third', label: 'Третье' },
  { value: 'fourth', label: 'Четвертое' },
  { value: 'last', label: 'Последнее' },
] as const;

export function useTab5DstTransitionRules(props: Tab5DstTransitionRulesProps) {
  const monthOptions = computed(() =>
    props.monthNames.map((m, i) => ({
      value: String(i + 1),
      label: `${i + 1}. ${m}`,
    }))
  );

  const occurrenceOptions = OCCURRENCE_OPTIONS;

  const weekdayOptions = computed(() =>
    props.weekdayNames.map((w, i) => ({
      value: String(i),
      label: w,
    }))
  );

  return {
    monthOptions,
    occurrenceOptions,
    weekdayOptions,
  };
}
