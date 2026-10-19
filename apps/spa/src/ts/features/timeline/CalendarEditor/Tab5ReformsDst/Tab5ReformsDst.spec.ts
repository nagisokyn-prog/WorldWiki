import { describe, it, expect, vi } from 'vitest';
import { useTab5ReformsDst } from './useTab5ReformsDst';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab5ReformsDst', () => {
  const mockCalendar = {
    название: 'Reforms Calendar',
    reforms: [
      {
        name: 'Григорианская реформа',
        effective_year: 1582,
        mode: 'DiscontinuousGap' as const,
        skipped_days: 10,
      },
    ],
    dst_policy: {
      is_enabled: true,
      spring_shift_minutes: 60,
      autumn_shift_minutes: -60,
    },
  } as unknown as CalendarData;

  it('computes reforms and dst policy', () => {
    const emit = vi.fn();
    const { reforms, dstPolicy } = useTab5ReformsDst(
      { calendarData: mockCalendar },
      emit
    );

    expect(reforms.value.length).toBe(1);
    expect(dstPolicy.value.is_enabled).toBe(true);
  });

  it('adds and removes reforms', () => {
    const emit = vi.fn();
    const { addReform, removeReform } = useTab5ReformsDst(
      { calendarData: mockCalendar },
      emit
    );

    addReform('EpochReset');
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      reforms: expect.any(Array),
    }));

    removeReform(0);
    expect(emit).toHaveBeenCalledWith('update', {
      reforms: [],
    });
  });

  it('toggles DST', () => {
    const emit = vi.fn();
    const { toggleDst } = useTab5ReformsDst(
      { calendarData: mockCalendar },
      emit
    );

    toggleDst(false);
    expect(emit).toHaveBeenCalledWith('update', {
      dst_policy: {
        is_enabled: false,
        spring_shift_minutes: 60,
        autumn_shift_minutes: -60,
      },
    });
  });
});
