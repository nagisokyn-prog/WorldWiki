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

  it('handles addMonth and removeMonth when modelValue has no months array', () => {
    const emptyProps: any = { modelValue: {} };
    const hook = useCalendarMonths(emptyProps);

    hook.moveItem(0, 1);
    hook.removeMonth(0);
    expect(emptyProps.modelValue.месяцы).toBeUndefined();

    hook.addMonth();
    expect(emptyProps.modelValue.месяцы.length).toBe(1);
    expect(emptyProps.modelValue.месяцы[0].название).toBe('Месяц 1');
    expect(emptyProps.modelValue.месяцы[0].дней).toBe(30);
  });

  it('moves items within bounds and ignores out of bounds moves', () => {
    const hook = useCalendarMonths(props);

    // Out of bounds up
    hook.moveItem(0, -1);
    expect(props.modelValue.месяцы[0].название).toBe('Январь');

    // Valid move down
    hook.moveItem(0, 1);
    expect(props.modelValue.месяцы[0].название).toBe('Февраль');
    expect(props.modelValue.месяцы[1].название).toBe('Январь');

    // Out of bounds down
    hook.moveItem(1, 1);
    expect(props.modelValue.месяцы[1].название).toBe('Январь');

    hook.removeMonth(0);
    expect(props.modelValue.месяцы.length).toBe(1);

    // addMonth when array already exists
    hook.addMonth();
    expect(props.modelValue.месяцы.length).toBe(2);
    expect(props.modelValue.месяцы[1].название).toBe('Месяц 2');
  });
});
