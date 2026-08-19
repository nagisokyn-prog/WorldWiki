import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDateWheels } from '../useDateWheels';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
  },
}));

describe('useDateWheels', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      modelValue: {
        эпоха: 0,
        год: 10,
        месяц: 0,
        день: 5,
      },
    };
  });

  it('computes options and handles date changes', () => {
    const wheels = useDateWheels(props, emit);

    expect(wheels.currentEraIdx.value).toBe(0);
    expect(wheels.currentYear.value).toBe(10);
    expect(wheels.currentDay.value).toBe(5);
  });
});
