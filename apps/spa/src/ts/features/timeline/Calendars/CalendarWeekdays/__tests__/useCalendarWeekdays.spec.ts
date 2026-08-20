import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarWeekdays } from '../useCalendarWeekdays';

describe('useCalendarWeekdays', () => {
  let props: any;

  beforeEach(() => {
    props = {
      modelValue: {
        названия_дней_недели: ['Пн', 'Вт'],
      },
    };
  });

  it('handles addDay, updateDay and removeDay when modelValue has no weekdays array', () => {
    const emptyProps: any = { modelValue: {} };
    const hook = useCalendarWeekdays(emptyProps);

    hook.removeDay(0);
    hook.updateDay(0, 'Test');
    expect(emptyProps.modelValue.названия_дней_недели).toBeUndefined();

    hook.addDay();
    expect(emptyProps.modelValue.названия_дней_недели.length).toBe(1);
    expect(emptyProps.modelValue.названия_дней_недели[0]).toBe('День 1');
  });

  it('moves items within bounds and ignores out of bounds moves', () => {
    const hook = useCalendarWeekdays(props);

    // Out of bounds up
    hook.moveItem(0, -1);
    expect(props.modelValue.названия_дней_недели[0]).toBe('Пн');

    // Valid move down
    hook.moveItem(0, 1);
    expect(props.modelValue.названия_дней_недели[0]).toBe('Вт');
    expect(props.modelValue.названия_дней_недели[1]).toBe('Пн');

    // Out of bounds down
    hook.moveItem(1, 1);
    expect(props.modelValue.названия_дней_недели[1]).toBe('Пн');

    hook.removeDay(0);
    expect(props.modelValue.названия_дней_недели.length).toBe(1);

    // updateDay on populated array (covers line 28)
    hook.updateDay(0, 'Понедельник');
    expect(props.modelValue.названия_дней_недели[0]).toBe('Понедельник');
  });
});
