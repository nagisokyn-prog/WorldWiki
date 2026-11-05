import { computed } from 'vue';
import type { Tab1MonthsSectionProps } from './Tab1MonthsSection.model';
import { DEFAULT_CALENDAR_SEASONS } from '@/services/Calendars/calendar.types';

export function useTab1MonthsSection(props: Tab1MonthsSectionProps) {
  const effectiveSeasons = computed(() => {
    if (props.seasons && props.seasons.length > 0) {
      return props.seasons;
    }
    if (props.months.length === 12) {
      return DEFAULT_CALENDAR_SEASONS;
    }
    return [];
  });

  const seasonInfo = computed(() => {
    const total = props.months.length;
    if (total === 0) return [];

    return props.months.map((_, idx) => {
      if (effectiveSeasons.value && effectiveSeasons.value.length > 0) {
        const matched = effectiveSeasons.value.find(
          (s) => Array.isArray(s.месяцы) && (s.месяцы.map(Number).includes(idx) || s.месяцы.map(Number).includes(idx + 1))
        );
        if (matched && matched.название) {
          return { name: matched.название, color: matched.цвет || matched.color };
        }
      }
      return { name: '—', color: undefined };
    });
  });

  const seasonLabels = computed(() => seasonInfo.value.map((s) => s.name));

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
    seasonInfo,
    monthOptions,
    maxDaysInSelectedMonth,
  };
}
