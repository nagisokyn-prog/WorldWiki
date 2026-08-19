import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarTimezones } from '../useCalendarTimezones';

describe('useCalendarTimezones', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    emit = vi.fn();
    props = {
      modelValue: {
        timezone_regions: [
          { id: 'tz_1', name: 'Capital', offset_minutes: 0 },
        ],
      },
    };
  });

  it('adds and removes timezones', () => {
    const hook = useCalendarTimezones(props, emit);

    hook.addTz();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      timezone_regions: expect.arrayContaining([expect.objectContaining({ name: 'Новый регион' })]),
    }));

    hook.removeTz(0);
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      timezone_regions: [],
    }));
  });
});
