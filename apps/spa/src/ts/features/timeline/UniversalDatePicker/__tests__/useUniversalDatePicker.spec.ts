import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, reactive, nextTick } from 'vue';
import { useUniversalDatePicker } from '../useUniversalDatePicker';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { settingsService } from '@worldwiki/components';

let mockGetCalendars: any;
let mockSettingsOnChange: any;

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: (...args: any[]) => mockGetCalendars(...args),
  }),
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn((cb) => { mockSettingsOnChange = cb; }),
  },
}));

describe('useUniversalDatePicker', () => {
  let props: any;
  let emit: any;

  const mockCalendar = {
    id: 'cal_1',
    is_default: true,
    data: {
      название: 'Main Calendar',
      эпохи: [
        { название: 'Era 1', год_начала: 1, год_конца: 200 },
        { название: 'Era 2', год_начала: 201, год_конца: 1000 },
      ],
      месяцы: [{ название: 'Month 1', дней: 30 }],
      настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    mockGetCalendars = vi.fn().mockResolvedValue([mockCalendar]);

    props = {
      project: 'p1',
      showTime: true,
      modelValue: {
        calendar_id: 'cal_1',
        original_input: {
          era_index: 0,
          year: 100,
          month: 0,
          day: 15,
          hour: 14,
          minute: 30,
        },
      },
    };
  });

  it('mounts, fetches calendars, and synchronizes from modelValue', async () => {
    const TestComponent = defineComponent({
      props: ['project', 'showTime', 'modelValue'],
      emits: ['update:modelValue'],
      setup(p, { emit: e }) {
        return { ...useUniversalDatePicker(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent, { props });
    await flushPromises();

    const vm = wrapper.vm as any;
    expect(vm.wheelHorizontal).toBe(true);
    expect(vm.currentCalendarId).toBe('cal_1');
    expect(vm.currentYear).toBe(100);
    expect(vm.eraOptions.length).toBe(2);
    expect(vm.yearOptions.length).toBe(200);
    expect(vm.monthOptions.length).toBe(1);
    expect(vm.dayOptions.length).toBe(30);
    expect(vm.hourOptions.length).toBe(24);
    expect(vm.minuteOptions.length).toBe(60);

    // Settings onChange update
    if (mockSettingsOnChange) {
      mockSettingsOnChange({ dropdowns: { wheelOrientation: 'vertical' } });
      expect(vm.wheelHorizontal).toBe(false);
    }

    wrapper.unmount();
  });

  it('handles calendar fetch failure with fallback calendar', async () => {
    mockGetCalendars.mockRejectedValueOnce(new Error('Network error'));

    const TestComponent = defineComponent({
      props: ['project', 'showTime', 'modelValue'],
      emits: ['update:modelValue'],
      setup(p, { emit: e }) {
        return { ...useUniversalDatePicker(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent, {
      props: { project: 'p1', showTime: false, modelValue: null },
    });
    await flushPromises();

    const vm = wrapper.vm as any;
    expect(vm.allCalendars.length).toBe(1);
    expect(vm.currentCalendarId).toBe('temp');

    wrapper.unmount();
  });

  it('synchronizes legacy modelValue with epoch key', async () => {
    const TestComponent = defineComponent({
      props: ['project', 'showTime', 'modelValue'],
      emits: ['update:modelValue'],
      setup(p, { emit: e }) {
        return { ...useUniversalDatePicker(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent, {
      props: {
        project: 'p1',
        showTime: true,
        modelValue: {
          эпоха_ключ: 0,
          год: 50,
          месяц: 0,
          день: 10,
        },
      },
    });
    await flushPromises();

    const vm = wrapper.vm as any;
    expect(vm.currentYear).toBe(50);
    expect(vm.currentDay).toBe(10);

    wrapper.unmount();
  });

  it('validates and clamps out of bounds dates and times', () => {
    const picker = useUniversalDatePicker(props, emit);
    picker.allCalendars.value = [mockCalendar];
    picker.currentCalendarId.value = 'cal_1';

    // Out of bounds era
    picker.currentEraIdx.value = 99;
    picker.onEraChange();
    expect(picker.currentEraIdx.value).toBe(0);

    // Out of bounds year
    picker.currentYear.value = 9999;
    picker.onYearChange();
    expect(picker.currentYear.value).toBe(200);

    // Out of bounds month
    picker.currentMonthIdx.value = 50;
    picker.onMonthChange();
    expect(picker.currentMonthIdx.value).toBe(0);

    // Out of bounds day
    picker.currentDay.value = 99;
    picker.onDayChange();
    expect(picker.currentDay.value).toBe(30);

    // Out of bounds time
    picker.currentHour.value = 30;
    picker.currentMinute.value = 90;
    picker.onTimeChange();
    expect(picker.currentHour.value).toBe(0);
    expect(picker.currentMinute.value).toBe(0);

    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));
  });

  it('activates yearInputMode when era span is large', () => {
    const picker = useUniversalDatePicker(props, emit);
    picker.allCalendars.value = [mockCalendar];
    picker.currentCalendarId.value = 'cal_1';
    picker.currentEraIdx.value = 1; // Era 2: 201 to 1000 (span 799 > 500)

    expect(picker.yearInputMode.value).toBe(true);
    expect(picker.yearOptions.value).toEqual([]);
  });

  it('reacts to reactive modelValue prop changes in deep watch', async () => {
    const reactiveProps = reactive({
      project: 'p1',
      showTime: true,
      modelValue: {
        calendar_id: 'cal_1',
        original_input: {
          era_index: 0,
          year: 50,
          month: 0,
          day: 10,
          hour: 12,
          minute: 0,
        },
      },
    });

    const picker = useUniversalDatePicker(reactiveProps, emit);
    picker.allCalendars.value = [mockCalendar];
    picker.currentCalendarId.value = 'cal_1';

    reactiveProps.modelValue = {
      calendar_id: 'cal_1',
      original_input: {
        era_index: 0,
        year: 80,
        month: 0,
        day: 20,
        hour: 15,
        minute: 45,
      },
    };
    await nextTick();

    expect(picker.currentYear.value).toBe(80);
    expect(picker.currentDay.value).toBe(20);
    expect(picker.currentHour.value).toBe(15);
  });

  describe('Additional branch edge cases for useUniversalDatePicker', () => {
    it('validates and clamps era, year, month, day, hour and minute bounds', () => {
      const picker = useUniversalDatePicker(props, emit);
      picker.allCalendars.value = [mockCalendar];
      picker.currentCalendarId.value = 'cal_1';

      // 1. Invalid era
      picker.currentEraIdx.value = 999;
      picker.onEraChange();
      expect(picker.currentEraIdx.value).toBe(0);

      // 2. Year below min and above max
      picker.currentYear.value = -10;
      picker.onYearChange();
      expect(picker.currentYear.value).toBe(1);

      picker.currentYear.value = 5000;
      picker.onYearChange();
      expect(picker.currentYear.value).toBe(200);

      // 3. Month out of bounds
      picker.currentMonthIdx.value = -1;
      picker.onMonthChange();
      expect(picker.currentMonthIdx.value).toBe(0);

      // 4. Day below 1
      picker.currentDay.value = -5;
      picker.onDayChange();
      expect(picker.currentDay.value).toBe(1);

      // 5. Hour and minute out of bounds
      picker.currentHour.value = -2;
      picker.currentMinute.value = 100;
      picker.onTimeChange();
      expect(picker.currentHour.value).toBe(0);
      expect(picker.currentMinute.value).toBe(0);
    });

    it('handles modelValue with null hour/minute and null modelValue fallback', async () => {
      const reactiveProps = reactive({
        project: 'p1',
        showTime: true,
        modelValue: {
          calendar_id: 'cal_1',
          original_input: {
            era_index: 0,
            year: 50,
            month: 0,
            day: 10,
            // no hour / minute
          } as any,
        },
      });

      const picker = useUniversalDatePicker(reactiveProps, emit);
      picker.allCalendars.value = [mockCalendar];
      await nextTick();

      expect(picker.currentHour.value).toBe(12);
      expect(picker.currentMinute.value).toBe(0);

      // Null modelValue fallback
      const nullProps = { project: 'p1', showTime: true, modelValue: null };
      const pickerNull = useUniversalDatePicker(nullProps as any, emit);
      pickerNull.allCalendars.value = [
        { id: 'cal_no_def', data: mockCalendar.data },
      ];
      pickerNull.currentCalendarId.value = 'cal_no_def';
      pickerNull.onCalendarChange();
      expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));
    });

    it('handles onEraChange year bounds clamping, legacy modelValue watch, and unnamed calendarOptions', async () => {
      const reactiveProps = reactive({
        project: 'p1',
        showTime: false,
        modelValue: {
          calendar_id: 'cal_1',
          original_input: { era_index: 0, year: 150, month: 0, day: 5 },
        } as any,
      });

      const picker = useUniversalDatePicker(reactiveProps, emit);
      picker.allCalendars.value = [
        mockCalendar,
        { id: 'cal_empty', data: {} }, // unnamed calendar
      ];
      picker.currentCalendarId.value = 'cal_1';

      // 1. unnamed calendar in calendarOptions
      expect(picker.calendarOptions.value[1].label).toBe('Календарь');

      // 2. onEraChange when currentYear (150) is out of bounds for Era 2 (201-1000)
      picker.currentEraIdx.value = 1;
      picker.onEraChange();
      expect(picker.currentYear.value).toBe(201); // Clamped to Era 2's год_начала

      // 3. legacy modelValue watch format with эпоха_ключ
      reactiveProps.modelValue = {
        эпоха_ключ: 0,
        год: 77,
        месяц: 0,
        день: 12,
      };
      await nextTick();
      expect(picker.currentYear.value).toBe(77);
    });

    it('covers all watch branches: null newVal, identical values, different properties, showTime', async () => {
      const reactiveProps = reactive({
        project: 'p1',
        showTime: true,
        modelValue: {
          calendar_id: 'cal_1',
          original_input: { era_index: 0, year: 100, month: 0, day: 15, hour: 14, minute: 30 },
        } as any,
      });

      const picker = useUniversalDatePicker(reactiveProps, emit);
      picker.allCalendars.value = [mockCalendar];
      await nextTick();

      // 1. null newVal
      reactiveProps.modelValue = null;
      await nextTick();

      // 2. Identical values (no sync)
      reactiveProps.modelValue = {
        calendar_id: 'cal_1',
        original_input: { era_index: 0, year: 100, month: 0, day: 15, hour: 14, minute: 30 },
      };
      await nextTick();

      // 3. Different era_index
      reactiveProps.modelValue = {
        calendar_id: 'cal_1',
        original_input: { era_index: 1, year: 205, month: 0, day: 15, hour: 14, minute: 30 },
      };
      await nextTick();
      expect(picker.currentEraIdx.value).toBe(1);

      // 4. Different month
      reactiveProps.modelValue = {
        calendar_id: 'cal_1',
        original_input: { era_index: 1, year: 205, month: 1, day: 15, hour: 14, minute: 30 },
      };
      await nextTick();

      // 5. Different minute
      reactiveProps.modelValue = {
        calendar_id: 'cal_1',
        original_input: { era_index: 1, year: 205, month: 1, day: 15, hour: 14, minute: 45 },
      };
      await nextTick();
      expect(picker.currentMinute.value).toBe(45);

      // 6. Object without matching fields
      reactiveProps.modelValue = { foo: 'bar' } as any;
      await nextTick();
    });

    it('handles empty list returned from getCalendars and fallback calendar generation', async () => {
      mockGetCalendars.mockResolvedValueOnce([]);

      const TestComponent = defineComponent({
        props: ['project', 'showTime', 'modelValue'],
        emits: ['update:modelValue'],
        setup(p, { emit: e }) {
          return { ...useUniversalDatePicker(p, e) };
        },
        template: '<div></div>',
      });

      const wrapper = mount(TestComponent, {
        props: { project: 'p1', showTime: false, modelValue: null },
      });
      await flushPromises();

      const vm = wrapper.vm as any;
      expect(vm.allCalendars.length).toBe(1);
      expect(vm.currentCalendarId).toBe('temp');

      wrapper.unmount();
    });

    it('handles unnamed eras, months, and missing calendar gracefully', () => {
      const bareCalendar = {
        id: 'cal_bare',
        data: {
          эпохи: [{ год_начала: 1, год_конца: 10 }], // No название
          месяцы: [{}], // No название
          настройки_времени: { часов_в_сутках: 10, минут_в_часе: 20 },
        },
      };

      const propsBare = {
        project: 'p1',
        showTime: false,
        modelValue: {
          эпоха_ключ: 0,
          // no год, месяц, день
        },
      };

      const picker = useUniversalDatePicker(propsBare, emit);
      picker.allCalendars.value = [bareCalendar];
      picker.currentCalendarId.value = 'cal_bare';

      expect(picker.eraOptions.value[0].label).toBe('Эпоха 1');
      expect(picker.monthOptions.value[0].label).toBe('Месяц 1');

      // Test with empty calendar ID
      picker.currentCalendarId.value = '';
      expect(picker.dayOptions.value.length).toBe(30);
      picker.onCalendarChange(); // should return early in emitUpdate / validateValues
    });
  });
});


