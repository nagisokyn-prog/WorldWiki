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

  it('handles addTz, removeTz, updateParent, and uninitialized timezone_regions', () => {
    const emptyProps: any = { modelValue: {} };
    const emptyHook = useCalendarTimezones(emptyProps, emit);

    expect(emptyHook.timezoneRegions.value).toEqual([]);

    emptyHook.updateParent();
    expect(emit).toHaveBeenCalledWith('update:modelValue', { timezone_regions: [] });

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

  it('manages world timezones and regions with coordinates', () => {
    const hook = useCalendarTimezones(props, emit);

    hook.addTimezone();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      timezones: expect.arrayContaining([expect.objectContaining({ name: 'Часовой пояс 2' })]),
    }));

    hook.addRegion();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      regions: expect.arrayContaining([expect.objectContaining({ name: 'Регион 1', latitude: 45 })]),
    }));

    hook.removeRegion(0);
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      regions: [],
    }));

    hook.removeTimezone(0);
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      timezones: [],
    }));
  });
});
