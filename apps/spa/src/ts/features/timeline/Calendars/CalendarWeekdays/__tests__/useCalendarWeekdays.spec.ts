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

  it('adds, moves, updates and removes weekdays', () => {
    const hook = useCalendarWeekdays(props);

    hook.addDay();
    expect(props.modelValue.названия_дней_недели.length).toBe(3);

    hook.updateDay(0, 'Понедельник');
    expect(props.modelValue.названия_дней_недели[0]).toBe('Понедельник');

    hook.moveItem(0, 1);
    expect(props.modelValue.названия_дней_недели[0]).toBe('Вт');

    hook.removeDay(0);
    expect(props.modelValue.названия_дней_недели.length).toBe(2);
  });
});
