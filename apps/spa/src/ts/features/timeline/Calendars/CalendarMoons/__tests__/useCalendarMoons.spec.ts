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

  it('adds and moves moons', () => {
    const hook = useCalendarMoons(props, emit);

    hook.addMoon();
    expect(props.modelValue.moons.length).toBe(2);

    hook.moveItem(props.modelValue.moons, 0, 1);
    expect(props.modelValue.moons[0].name).toBe('Луна 2');
  });
});
