import { describe, it, expect, vi } from 'vitest';
import { useTab3HolidaysSection } from './useTab3HolidaysSection';
import type { CultureHolidayDto } from '../../Tab3CultureLore.model';

describe('useTab3HolidaysSection', () => {
  it('does nothing when isReadOnly is true', () => {
    const h: CultureHolidayDto = {
      id: 'h1',
      название: 'Праздник',
      дата_начала: { месяц: 1, день: 5 },
      is_range: false,
    } as CultureHolidayDto;
    const emit = vi.fn();
    const { toggleRange } = useTab3HolidaysSection({ holidays: [h], isReadOnly: true }, emit);

    toggleRange(h);
    expect(h.is_range).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  it('toggles range on and initializes end date when missing', () => {
    const h: CultureHolidayDto = {
      id: 'h1',
      название: 'Праздник',
      дата_начала: { месяц: 2, день: 10 },
      is_range: false,
    } as CultureHolidayDto;
    const emit = vi.fn();
    const { toggleRange } = useTab3HolidaysSection({ holidays: [h] }, emit);

    toggleRange(h);
    expect(h.is_range).toBe(true);
    expect(h.дата_конца).toEqual({ месяц: 2, день: 13 });
    expect(emit).toHaveBeenCalledWith('update-holidays', [h]);
  });

  it('preserves existing end date when toggling range off and back on', () => {
    const h: CultureHolidayDto = {
      id: 'h1',
      название: 'Праздник',
      дата_начала: { месяц: 2, день: 10 },
      дата_конца: { месяц: 2, день: 20 },
      is_range: true,
    } as CultureHolidayDto;
    const emit = vi.fn();
    const { toggleRange } = useTab3HolidaysSection({ holidays: [h], isReadOnly: false }, emit);

    toggleRange(h);
    expect(h.is_range).toBe(false);
    toggleRange(h);
    expect(h.is_range).toBe(true);
    expect(h.дата_конца).toEqual({ месяц: 2, день: 20 });
    expect(emit).toHaveBeenCalledTimes(2);
  });
});
