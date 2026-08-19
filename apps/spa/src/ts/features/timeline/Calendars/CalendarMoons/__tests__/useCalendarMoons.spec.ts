import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarMoons } from '../useCalendarMoons';

describe('useCalendarMoons', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    emit = vi.fn();
    props = {
      modelValue: {
        moons: [
          { name: 'Луна 1', period_days: 28, initial_phase: 0 },
        ],
      },
    };
  });

  it('handles addMoon and moveItem with null array, out of bounds, and uninitialized moons', () => {
    const emptyProps: any = { modelValue: {} };
    const hook = useCalendarMoons(emptyProps, emit);

    // addMoon initializes moons array
    hook.addMoon();
    expect(emptyProps.modelValue.moons.length).toBe(1);

    // moveItem on null
    hook.moveItem(null as any, 0, 1);

    // moveItem out of bounds
    hook.moveItem(emptyProps.modelValue.moons, 0, -1);
    hook.moveItem(emptyProps.modelValue.moons, 0, 5);

    // calendar setter
    hook.calendar.value = { moons: [] };
    expect(emit).toHaveBeenCalledWith('update:modelValue', { moons: [] });
  });

  it('moves items within bounds', () => {
    const hook = useCalendarMoons(props, emit);

    hook.addMoon();
    expect(props.modelValue.moons.length).toBe(2);

    hook.moveItem(props.modelValue.moons, 0, 1);
    expect(props.modelValue.moons[0].name).toBe('Луна 2');
  });
});
