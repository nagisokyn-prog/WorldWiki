import { computed } from 'vue';
import type { CultureHolidayDto } from '../../Tab3CultureLore.model';
import type { Tab3HolidaysSectionProps } from './Tab3HolidaysSection.model';

export function useTab3HolidaysSection(
  props: { holidays: CultureHolidayDto[]; isReadOnly?: boolean; months?: Tab3HolidaysSectionProps['months'] },
  emit: (e: 'update-holidays', list: CultureHolidayDto[]) => void,
) {
  const monthWheelOptions = computed(() =>
    (props.months || []).map((m, mIdx) => ({
      value: mIdx,
      label: m.название || `Месяц ${mIdx + 1}`,
    }))
  );

  const toggleRange = (h: CultureHolidayDto) => {
    if (props.isReadOnly) return;
    h.is_range = !h.is_range;
    if (h.is_range && !h.дата_конца) {
      h.дата_конца = { месяц: h.дата_начала.месяц, день: h.дата_начала.день + 3 };
    }
    emit('update-holidays', [...props.holidays]);
  };

  return {
    monthWheelOptions,
    toggleRange,
  };
}
