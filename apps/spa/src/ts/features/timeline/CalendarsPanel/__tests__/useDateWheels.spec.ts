import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, reactive, nextTick } from 'vue';
import { useDateWheels } from '../useDateWheels';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { settingsService } from '@worldwiki/components';

let mockLoadCalendar: any;
let mockSettingsOnChange: any;

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn((cb) => { mockSettingsOnChange = cb; }),
  },
}));

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    loadCalendar: (...args: any[]) => mockLoadCalendar(...args),
  }),
}));

describe('useDateWheels', () => {
  let props: any;
  let emit: any;

  const mockCal = {
    название: 'Календарь',
    эпохи: [
      { год_начала: 1, год_конца: 100, название: 'Эпоха 1' },
      { год_начала: 101, год_конца: 800, название: 'Эпоха 2' },
    ],
    месяцы: [{ название: 'Январь', дней: 30 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    mockLoadCalendar = vi.fn().mockResolvedValue(mockCal);
    props = {
      project: 'p1',
      modelValue: {
        эпоха_ключ: 0,
        год: 10,
        месяц: 0,
        день: 5,
      },
    };
  });

  it('mounts, loads calendar and sets up options and syncs props', async () => {
    const TestComponent = defineComponent({
      props: ['project', 'modelValue'],
      emits: ['update:modelValue'],
      setup(p, { emit: e }) {
        return { ...useDateWheels(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent, { props });
    await Promise.resolve();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    expect(vm.wheelHorizontal).toBe(true);
    expect(vm.currentYear).toBe(10);
    expect(vm.eraOptions.length).toBe(2);
    expect(vm.yearOptions.length).toBe(100);
    expect(vm.monthOptions.length).toBe(1);
    expect(vm.dayOptions.length).toBe(30);

    if (mockSettingsOnChange) {
      mockSettingsOnChange({ dropdowns: { wheelOrientation: 'vertical' } });
      expect(vm.wheelHorizontal).toBe(false);
    }

    wrapper.unmount();
  });

  it('handles null calendar response from store with default calendar', async () => {
    mockLoadCalendar.mockResolvedValueOnce(null);

    const TestComponent = defineComponent({
      props: ['project', 'modelValue'],
      emits: ['update:modelValue'],
      setup(p, { emit: e }) {
        return { ...useDateWheels(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent, {
      props: { project: 'p1', modelValue: null },
    });
    await Promise.resolve();

    const vm = wrapper.vm as any;
    expect(vm.calendar).toBeDefined();
    expect(vm.currentDay).toBe(1);

    wrapper.unmount();
  });

  it('validates and clamps values on changes', () => {
    const wheels = useDateWheels(props, emit);
    wheels.calendar.value = mockCal;

    // Out of bounds era
    wheels.currentEraIdx.value = 1; // span 699 > 500
    wheels.onEraChange();
    expect(wheels.yearInputMode.value).toBe(true);
    expect(wheels.yearOptions.value).toEqual([]);

    // Out of bounds year
    wheels.currentYear.value = 5000;
    wheels.onYearChange();
    expect(wheels.currentYear.value).toBe(800);

    // Out of bounds month
    wheels.currentMonthIdx.value = 10;
    wheels.onMonthChange();
    expect(wheels.currentMonthIdx.value).toBe(0);

    // Out of bounds day
    wheels.currentDay.value = 50;
    wheels.onDayChange();
    expect(wheels.currentDay.value).toBe(30);

    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));
  });

  it('reacts to modelValue changes in deep watch', async () => {
    const reactiveProps = reactive({
      project: 'p1',
      modelValue: {
        эпоха_ключ: 0,
        год: 10,
        месяц: 0,
        день: 5,
      },
    });

    const wheels = useDateWheels(reactiveProps, emit);
    wheels.calendar.value = mockCal;

    reactiveProps.modelValue = {
      эпоха_ключ: 0,
      год: 25,
      месяц: 0,
      день: 12,
    };
    await nextTick();

    expect(wheels.currentYear.value).toBe(25);
    expect(wheels.currentDay.value).toBe(12);
  });

  it('validates and clamps year below min, year above max, month below 0 and day below 1', () => {
    const wheels = useDateWheels(props, emit);
    wheels.calendar.value = mockCal;

    // Year below min
    wheels.currentYear.value = -100;
    wheels.onYearChange();
    expect(wheels.currentYear.value).toBe(1);

    // Year above max
    wheels.currentYear.value = 9999;
    wheels.onYearChange();
    expect(wheels.currentYear.value).toBe(100);

    // Month below 0
    wheels.currentMonthIdx.value = -5;
    wheels.onMonthChange();
    expect(wheels.currentMonthIdx.value).toBe(0);

    // Day below 1
    wheels.currentDay.value = -10;
    wheels.onDayChange();
    expect(wheels.currentDay.value).toBe(1);
  });

  it('handles null and identical modelValue updates in watch', async () => {
    const reactiveProps = reactive({
      project: 'p1',
      modelValue: { эпоха_ключ: 0, год: 10, месяц: 0, день: 5 },
    });

    const wheels = useDateWheels(reactiveProps, emit);
    wheels.calendar.value = mockCal;

    // 1. null modelValue
    (reactiveProps as any).modelValue = null;
    await nextTick();

    // 2. identical modelValue
    reactiveProps.modelValue = { эпоха_ключ: 0, год: 10, месяц: 0, день: 5 };
    await nextTick();
  });
});


