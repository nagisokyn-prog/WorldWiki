import { computed } from 'vue';
import type { Tab5DualDatingCardProps } from './Tab5DualDatingCard.model';

/** Вычисляет опции XboxWheel для выбора месяца в карточке двойного датирования. */
export function useTab5DualDatingCard(props: Tab5DualDatingCardProps) {
  const monthWheelOptions = computed(() =>
    props.monthNames.map((m, i) => ({ value: i + 1, label: m }))
  );

  return {
    monthWheelOptions,
  };
}
