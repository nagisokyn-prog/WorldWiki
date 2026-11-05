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
  });
});
