import { describe, it, expect, vi } from 'vitest';
import { useCalendarExtraDays } from '../useCalendarExtraDays';
import { CalendarMath } from '../../../../../services/Calendars/useCalendarEngine';

describe('useCalendarExtraDays', () => {
  it('manages epagomenal days and week pause flag', () => {
    const cal = CalendarMath.getDefaultCalendar();
    const emit = vi.fn();

    const hook = useCalendarExtraDays({ modelValue: cal }, emit);

    expect(hook.baseDays.value).toBe(0);
    expect(hook.pauseWeek.value).toBe(false);

    hook.baseDays.value = 5;
    expect(hook.baseDays.value).toBe(5);
    expect(emit).toHaveBeenCalled();

    hook.pauseWeek.value = true;
    expect(hook.pauseWeek.value).toBe(true);
  });
});
