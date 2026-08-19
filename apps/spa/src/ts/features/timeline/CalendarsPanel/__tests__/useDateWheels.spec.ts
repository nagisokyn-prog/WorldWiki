import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDateWheels } from '../useDateWheels';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn(),
  },
}));

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    loadCalendar: vi.fn().mockResolvedValue({
      эпохи: [{ год_начала: 1, год_конца: 100, название: 'Эпоха 1' }],
      месяцы: [{ название: 'Январь', дней: 30 }],
    }),
  }),
}));

describe('useDateWheels', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
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

  it('computes options and handles date changes', () => {
    const wheels = useDateWheels(props, emit);

    expect(wheels.wheelHorizontal.value).toBe(true);
    expect(wheels.eraOptions.value).toEqual([]);

    wheels.onYearChange();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      эпоха_ключ: 0,
    }));
  });
});
