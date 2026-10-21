import type { CultureHolidayDto } from '../Tab3CultureLore.model';

export function useTab3HolidaysSection(
  props: { holidays: CultureHolidayDto[]; isReadOnly?: boolean },
  emit: (e: 'update-holidays', list: CultureHolidayDto[]) => void,
) {
  const toggleRange = (h: CultureHolidayDto) => {
    if (props.isReadOnly) return;
    h.is_range = !h.is_range;
    if (h.is_range && !h.дата_конца) {
      h.дата_конца = { месяц: h.дата_начала.месяц, день: h.дата_начала.день + 3 };
    }
    emit('update-holidays', [...props.holidays]);
  };

  return {
    toggleRange,
  };
}
