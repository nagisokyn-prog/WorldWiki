import { describe, it, expect, vi } from 'vitest';
import { useCalendarPlanetPhysics } from '../useCalendarPlanetPhysics';
import { CalendarMath } from '../../../../../services/Calendars/useCalendarEngine';

describe('useCalendarPlanetPhysics', () => {
  it('manages planet id, rotation, and day start mode', () => {
    const cal = CalendarMath.getDefaultCalendar();
    const emit = vi.fn();

    const hook = useCalendarPlanetPhysics({ modelValue: cal }, emit);

    expect(hook.planetId.value).toBe('earth');
    expect(hook.retrograde.value).toBe(false);

    hook.planetId.value = 'mars';
    expect(hook.planetId.value).toBe('mars');
    expect(emit).toHaveBeenCalled();

    hook.retrograde.value = true;
    expect(hook.retrograde.value).toBe(true);

    hook.dayStartMode.value = 'sunrise';
    expect(hook.dayStartMode.value).toBe('sunrise');
  });
});
