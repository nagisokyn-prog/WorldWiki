import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarHolidays } from '../useCalendarHolidays';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn(),
  },
}));

describe('useCalendarHolidays', () => {
  let props: any;

  beforeEach(() => {
    props = {
      modelValue: {
        месяцы: [{ название: 'Январь', дней: 31 }],
        праздники: [
          { название: 'Новый год', дата_начала: { месяц: 0, день: 1 }, дата_конца: { месяц: 0, день: 1 } },
        ],
      },
    };
  });

  it('adds, moves and removes holidays', () => {
    const hook = useCalendarHolidays(props);

    hook.addHoliday();
    expect(props.modelValue.праздники.length).toBe(2);

    hook.moveItem(0, 1);
    expect(props.modelValue.праздники[1].название).toBe('Новый год');

    hook.removeHoliday(0);
    expect(props.modelValue.праздники.length).toBe(1);
  });

  it('computes days in month', () => {
    const hook = useCalendarHolidays(props);
    expect(hook.getDaysInMonth(props.modelValue, 2024, 0)).toBe(31);
  });

  it('handles undefined holidays array and out-of-bounds moveItem', () => {
    const emptyProps: any = { modelValue: {} };
    const hook = useCalendarHolidays(emptyProps);

    // moveItem with undefined
    hook.moveItem(0, 1);

    // removeHoliday with undefined
    hook.removeHoliday(0);

    // addHoliday with undefined -> initializes empty array
    hook.addHoliday();
    expect(emptyProps.modelValue.праздники.length).toBe(1);

    // moveItem out of bounds
    hook.moveItem(0, -1);
    hook.moveItem(0, 10);
  });

  it('subscribes to settings onChange onMounted and updates wheelHorizontal', async () => {
    const { mount } = await import('@vue/test-utils');
    const { defineComponent } = await import('vue');

    let cbOnChange: any;
    const { settingsService } = await import('@worldwiki/components');
    vi.mocked(settingsService.onChange).mockImplementation((cb: any) => {
      cbOnChange = cb;
    });

    let hookInstance: any;
    const TestComp = defineComponent({
      props: ['modelValue'],
      setup(p) {
        hookInstance = useCalendarHolidays(p as any);
        return { ...hookInstance };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp, { props });
    expect(hookInstance.wheelHorizontal.value).toBe(true);

    if (cbOnChange) {
      cbOnChange({ dropdowns: { wheelOrientation: 'vertical' } });
      expect(hookInstance.wheelHorizontal.value).toBe(false);
    }

    wrapper.unmount();
  });

  it('toggles holiday range and detects new year crossing', () => {
    const hook = useCalendarHolidays(props);
    const holiday: any = {
      дата_начала: { месяц: 11, день: 28 },
      дата_конца: { месяц: 0, день: 3 }
    };

    expect(hook.isNewYearCrossing(holiday)).toBe(true);

    const normalHoliday: any = {
      дата_начала: { месяц: 4, день: 1 },
      дата_конца: { месяц: 4, день: 9 }
    };
    expect(hook.isNewYearCrossing(normalHoliday)).toBe(false);

    // Toggle range off
    hook.toggleHolidayRange(holiday);
    expect(holiday.дата_конца).toBeUndefined();
    expect(hook.isNewYearCrossing(holiday)).toBe(false);

    // Toggle range back on
    hook.toggleHolidayRange(holiday);
    expect(holiday.дата_конца).toBeDefined();
    expect(holiday.дата_конца.месяц).toBe(11);
  });
});

