import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarOrigin } from '../useCalendarOrigin';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn(),
  },
}));

describe('useCalendarOrigin', () => {
  let props: any;

  beforeEach(() => {
    props = {
      modelValue: {
        месяцы: [{ название: 'Январь', дней: 30 }],
        точка_отсчета: { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 },
      },
    };
  });

  it('updates origin fields and gets days in month', () => {
    const hook = useCalendarOrigin(props);

    hook.updateOriginField('год', 100);
    expect(props.modelValue.точка_отсчета.год).toBe(100);

    expect(hook.getDaysInMonth(props.modelValue, 100, 0)).toBe(30);
  });
});
