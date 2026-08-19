import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUniversalDatePicker } from '../useUniversalDatePicker';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
  },
}));

describe('useUniversalDatePicker', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      modelValue: {
        calendar_id: 'cal_1',
        era: 0,
        year: 100,
        month: 1,
        day: 15,
        hour: 14,
        minute: 30,
      },
    };
  });

  it('computes options and manages state', () => {
    const picker = useUniversalDatePicker(props, emit);

    expect(picker.currentEraIdx.value).toBe(0);
    expect(picker.currentYear.value).toBe(100);
  });
});
