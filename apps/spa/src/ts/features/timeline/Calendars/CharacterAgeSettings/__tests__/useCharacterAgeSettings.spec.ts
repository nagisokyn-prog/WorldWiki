import { describe, it, expect, vi } from 'vitest';
import { useCharacterAgeSettings } from '../useCharacterAgeSettings';
import { CalendarMath } from '../../../../../services/Calendars/useCalendarEngine';

describe('useCharacterAgeSettings', () => {
  it('switches age calculation rules and recalculates sample age', () => {
    const cal = CalendarMath.getDefaultCalendar();
    const emit = vi.fn();

    const hook = useCharacterAgeSettings({ modelValue: cal }, emit);

    expect(hook.selectedSystem.value).toBe('western');
    // Born year 1000, current year 1020, birthday not yet reached -> 19
    expect(hook.sampleAge.value).toBe(19);

    hook.selectedSystem.value = 'east_asian';
    // +1 at birth + step on new year -> 20 + 1 = 21
    expect(hook.sampleAge.value).toBe(21);
    expect(emit).toHaveBeenCalled();
  });
});
