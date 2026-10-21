import { computed } from 'vue';
import type { CalendarMonth } from '@/services/Calendars/calendar.types';

export function useTab1MonthsSection(props: { months: CalendarMonth[] }) {
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

  return {
    seasonLabels,
  };
}
