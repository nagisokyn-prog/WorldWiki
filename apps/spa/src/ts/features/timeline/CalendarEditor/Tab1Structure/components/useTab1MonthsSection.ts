import { computed } from 'vue';
import type { Tab1MonthsSectionProps } from './Tab1MonthsSection.model';

export function useTab1MonthsSection(props: Tab1MonthsSectionProps) {
  const seasonLabels = computed(() => {
    const total = props.months.length;
    return props.months.map((_, idx) => {
      if (total === 0) return '—';
      const quarter = Math.floor((idx / total) * 4);
      if (quarter === 0) return '❄️ Зима';
      if (quarter === 1) return '🌸 Весна';
      if (quarter === 2) return '☀️ Лето';
      return '🍂 Осень';
    });
  });

  const monthOptions = computed(() =>
    props.months.map((m, idx) => ({
      value: String(idx),
      label: `${idx + 1}. ${m.название || `Месяц ${idx + 1}`}`,
    }))
  );

  const maxDaysInSelectedMonth = computed(() => {
    const selected = props.months[props.firstMonthOfYear ?? 0];
    return selected ? Number(selected.дней) || 31 : 31;
  });

  return {
    seasonLabels,
    monthOptions,
    maxDaysInSelectedMonth,
  };
}
