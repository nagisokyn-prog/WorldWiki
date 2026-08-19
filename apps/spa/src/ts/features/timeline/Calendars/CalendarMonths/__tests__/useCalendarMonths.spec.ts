import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarMonths } from '../useCalendarMonths';

describe('useCalendarMonths', () => {
  let props: any;

  beforeEach(() => {
    props = {
      modelValue: {
        месяцы: [
          { название: 'Январь', дней: 31 },
          { название: 'Февраль', дней: 28 },
        ],
      },
    };
  });

  it('adds, moves and removes months', () => {
    const hook = useCalendarMonths(props);

    hook.addMonth();
    expect(props.modelValue.месяцы.length).toBe(3);

    hook.moveItem(0, 1);
    expect(props.modelValue.месяцы[0].название).toBe('Февраль');

    hook.removeMonth(0);
    expect(props.modelValue.месяцы.length).toBe(2);
  });
});
