import { computed } from 'vue';
import type { Tab1MonthsSectionProps } from './Tab1MonthsSection.model';

function getSeasonIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('зим')) return '❄️';
  if (lower.includes('весн')) return '🌸';
  if (lower.includes('лет')) return '☀️';
  if (lower.includes('осен')) return '🍂';
  return '🌿';
}

export function useTab1MonthsSection(props: Tab1MonthsSectionProps) {
  const seasonLabels = computed(() => {
    const total = props.months.length;
    if (total === 0) return [];

    return props.months.map((_, idx) => {
      if (props.seasons && props.seasons.length > 0) {
        const matched = props.seasons.find(
          (s) => Array.isArray(s.месяцы) && s.месяцы.includes(idx)
        );
        if (matched && matched.название) {
          return `${getSeasonIcon(matched.название)} ${matched.название}`;
        }
      }
      return '—';
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
