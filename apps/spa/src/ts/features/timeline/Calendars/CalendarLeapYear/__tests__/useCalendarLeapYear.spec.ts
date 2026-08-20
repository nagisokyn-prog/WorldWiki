import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useCalendarLeapYear } from '../useCalendarLeapYear';

let mockSettingsCb: any;

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn((cb) => { mockSettingsCb = cb; }),
  },
}));

describe('useCalendarLeapYear', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      modelValue: {
        правило_високосного_года: 'none',
        пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 },
      },
    };
  });

  it('mounts and initializes default custom rule and settings listener', async () => {
    const emptyProps = { modelValue: {} };
    const TestComp = defineComponent({
      props: ['modelValue'],
      setup(p) {
        return { ...useCalendarLeapYear(p) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp, { props: emptyProps });
    await flushPromises();

    expect(emptyProps.modelValue.пользовательское_високосное_правило).toEqual({
      месяц: 0,
      день_смещения: 1,
    });

    if (mockSettingsCb) {
      mockSettingsCb({ dropdowns: { wheelOrientation: 'vertical' } });
      expect((wrapper.vm as any).wheelHorizontal).toBe(false);
    }
    wrapper.unmount();

    // Mount when custom rule already exists (covers branch line 25 false)
    const wrapperWithProps = mount(TestComp, { props });
    await flushPromises();
    expect(props.modelValue.пользовательское_високосное_правило.месяц).toBe(1);
    wrapperWithProps.unmount();
  });

  it('handles getters and setters when custom rule object is missing', () => {
    const emptyProps = { modelValue: {} };
    const hook = useCalendarLeapYear(emptyProps);

    // Getters with missing rule
    expect(hook.customRuleMonth.value).toBe(0);
    expect(hook.customRuleDays.value).toBe(1);

    // Set month when rule is missing
    hook.customRuleMonth.value = 5;
    expect(emptyProps.modelValue.пользовательское_високосное_правило).toEqual({
      месяц: 5,
      день_смещения: 1,
    });

    // Reset and set days when rule is missing
    emptyProps.modelValue.пользовательское_високосное_правило = undefined;
    hook.customRuleDays.value = 3;
    expect(emptyProps.modelValue.пользовательское_високосное_правило).toEqual({
      месяц: 0,
      день_смещения: 3,
    });
  });

  it('updates rule and existing custom rule', () => {
    const hook = useCalendarLeapYear(props);

    hook.updateRule('gregorian');
    expect(props.modelValue.правило_високосного_года).toBe('gregorian');

    hook.customRuleMonth.value = 2;
    expect(props.modelValue.пользовательское_високосное_правило.месяц).toBe(2);

    hook.customRuleDays.value = 2;
    expect(props.modelValue.пользовательское_високосное_правило.день_смещения).toBe(2);
  });
});
