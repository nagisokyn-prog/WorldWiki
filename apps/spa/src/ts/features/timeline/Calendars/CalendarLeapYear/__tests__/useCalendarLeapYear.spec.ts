import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarLeapYear } from '../useCalendarLeapYear';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn(),
  },
}));

describe('useCalendarLeapYear', () => {
  let props: any;

  beforeEach(() => {
    props = {
      modelValue: {
        правило_високосного_года: 'none',
        пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 },
      },
    };
  });

  it('updates rules and custom rule values', () => {
    const hook = useCalendarLeapYear(props);

    hook.updateRule('gregorian');
    expect(props.modelValue.правило_високосного_года).toBe('gregorian');

    hook.customRuleMonth.value = 2;
    expect(props.modelValue.пользовательское_високосное_правило.месяц).toBe(2);

    hook.customRuleDays.value = 2;
    expect(props.modelValue.пользовательское_високосное_правило.день_смещения).toBe(2);
  });
});
