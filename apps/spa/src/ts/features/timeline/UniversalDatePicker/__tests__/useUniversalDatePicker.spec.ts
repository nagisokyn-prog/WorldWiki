import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUniversalDatePicker } from '../useUniversalDatePicker';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn(),
  },
}));

describe('useUniversalDatePicker', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
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

  it('computes options, manages state and triggers change handlers', () => {
    const picker = useUniversalDatePicker(props, emit);

    expect(picker.wheelHorizontal.value).toBe(true);

    // Provide calendar & currentCalendarId
    picker.allCalendars.value = [
      {
        id: 'cal_1',
        data: {
          эпохи: [{ название: 'Era 1', год_начала: 1, год_конца: 200 }],
          месяцы: [{ название: 'Month 1', дней: 30 }],
          настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 },
        },
      },
    ];
    picker.currentCalendarId.value = 'cal_1';

    picker.onYearChange();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));

    picker.onMonthChange();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));

    picker.onDayChange();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));

    picker.onTimeChange();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));

    picker.onCalendarChange();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.any(Object));
  });
});
