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

  it('correctly extracts and sets whole hours and minutes fractions for daylight', () => {
    props.modelValue.настройки_времени = {
      часов_в_сутках: 24,
      минут_в_часе: 60,
    };
    const hook = useCalendarTimezones(props, emit);

    const testRegion = {
      id: 'reg_1',
      name: 'Test',
      timezone_id: 'tz_1',
      latitude: 45,
      longitude: 0,
      summer_day_hours: 16.5, // 16h 30m
      winter_day_hours: 8.25,  // 8h 15m
    };

    expect(hook.getSummerHours(testRegion)).toBe(16);
    expect(hook.getSummerMinutes(testRegion)).toBe(30);
    expect(hook.getWinterHours(testRegion)).toBe(8);
    expect(hook.getWinterMinutes(testRegion)).toBe(15);

    // Update summer hours to 17
    hook.setSummerHours(testRegion, 17);
    expect(testRegion.summer_day_hours).toBe(17.5);

    // Update summer minutes to 45
    hook.setSummerMinutes(testRegion, 45);
    expect(testRegion.summer_day_hours).toBe(17.75);

    // Update winter hours and minutes
    hook.setWinterHours(testRegion, 9);
    hook.setWinterMinutes(testRegion, 30);
    expect(testRegion.winter_day_hours).toBe(9.5);
  });
});
