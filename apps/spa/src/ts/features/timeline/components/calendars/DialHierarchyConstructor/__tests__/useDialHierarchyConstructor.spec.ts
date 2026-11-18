import { describe, it, expect, vi } from 'vitest';
import { useDialHierarchyConstructor } from '../useDialHierarchyConstructor';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';

describe('useDialHierarchyConstructor', () => {
  it('computes dial capacity and checks bijectivity', () => {
    const cal = CalendarMath.getDefaultCalendar();
    const emit = vi.fn();

    const hook = useDialHierarchyConstructor({ modelValue: cal }, emit);

    // Default: 24 * 60 = 1440
    expect(hook.totalCapacity.value).toBe(1440);
    expect(hook.isBijective.value).toBe(true);

    hook.addUnit();
    expect(hook.dialUnits.value.length).toBe(3);
    expect(emit).toHaveBeenCalled();

    // removeUnit & quantumErrorSec
    expect(hook.quantumErrorSec.value).toBe('60.00');
    hook.removeUnit(2);
    expect(hook.dialUnits.value.length).toBe(2);

    // setter & missing настройки_времени
    hook.dialUnits.value = [];
    expect(cal.dial_hierarchy?.units).toEqual([]);

    const sparseCal = { ...cal, dial_hierarchy: undefined, настройки_времени: undefined } as any;
    const hook2 = useDialHierarchyConstructor({ modelValue: sparseCal }, emit);
    expect(hook2.ticksPerDay.value).toBe(86400);
    expect(hook2.dialUnits.value).toHaveLength(2);
  });
});
