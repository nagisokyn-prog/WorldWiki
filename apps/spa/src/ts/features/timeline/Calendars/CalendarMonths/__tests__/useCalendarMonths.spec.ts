import { describe, it, expect, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { useCalendarMonths } from '../useCalendarMonths';
import type { CalendarMonthsProps } from '../useCalendarMonths';

describe('useCalendarMonths', () => {
  let props: CalendarMonthsProps;

  beforeEach(() => {
    props = reactive({
      modelValue: {
        месяцы: [
          { название: 'Январь', дней: 31 },
          { название: 'Февраль', дней: 28 },
        ],
      },
    });
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

  it('correctly calculates totalMonthsDays and daysBalance when target days in year is set or unset', () => {
    // With 31 + 28 = 59 days, no target
    const hook = useCalendarMonths(props);
    expect(hook.totalMonthsDays.value).toBe(59);
    expect(hook.daysBalanceText.value).toBe('59 дн');
    expect(hook.daysBalanceClass.value).toBe('balance-neutral');

    // With target = 365 (deficit)
    props.modelValue.дней_в_году = 365;
    expect(hook.targetYearDays.value).toBe(365);
    expect(hook.daysBalanceText.value).toContain('⚠️ 59 / 365 дн (-306)');
    expect(hook.daysBalanceClass.value).toBe('balance-warn');

    // When matched
    props.modelValue.дней_в_году = 59;
    expect(hook.daysBalanceText.value).toBe('✓ 59 / 59 дн');
    expect(hook.daysBalanceClass.value).toBe('balance-ok');

    // Excess
    props.modelValue.дней_в_году = 50;
    expect(hook.daysBalanceText.value).toContain('⚠️ 59 / 50 дн (+9)');
    expect(hook.daysBalanceClass.value).toBe('balance-warn');
  });
});
