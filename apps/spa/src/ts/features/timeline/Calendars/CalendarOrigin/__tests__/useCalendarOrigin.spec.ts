import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useCalendarOrigin } from '../useCalendarOrigin';
import { settingsService } from '@worldwiki/components';

let mockSettingsCb: any;

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn((cb) => { mockSettingsCb = cb; }),
  },
}));

describe('useCalendarOrigin', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      modelValue: {
        месяцы: [{ название: 'Январь', дней: 30 }],
        точка_отсчета: { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 },
      },
    };
  });

  it('mounts and initializes default origin point and settings listener', async () => {
    const emptyProps: any = { modelValue: {} };
    const TestComp = defineComponent({
      props: ['modelValue'],
      setup(p) {
        return { ...useCalendarOrigin(p as any) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp, { props: emptyProps });
    await flushPromises();

    expect(emptyProps.modelValue.точка_отсчета).toEqual({
      эпоха: 0,
      год: 1,
      месяц: 0,
      день: 1,
      день_недели: 0,
    });

    if (mockSettingsCb) {
      mockSettingsCb({ dropdowns: { wheelOrientation: 'vertical' } });
      expect((wrapper.vm as any).wheelHorizontal).toBe(false);
    }
  });

  it('handles updateOriginField when origin is defined and when missing', () => {
    const emptyProps: any = { modelValue: {} };
    const hookEmpty = useCalendarOrigin(emptyProps);
    hookEmpty.updateOriginField('год', 50);
    expect(emptyProps.modelValue.точка_отсчета).toBeUndefined();

    const hook = useCalendarOrigin(props);
    hook.updateOriginField('год', 100);
    expect(props.modelValue.точка_отсчета.год).toBe(100);

    expect(hook.getDaysInMonth(props.modelValue, 100, 0)).toBe(30);
  });
});
