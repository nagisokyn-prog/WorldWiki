import { describe, it, expect, vi } from 'vitest';
import { reactive } from 'vue';
import { useCalendarGeography } from '../useCalendarGeography';
import type { CalendarGeographyProps } from '../CalendarGeography.model';

describe('useCalendarGeography', () => {
  it('correctly provides available and selected regions and timezones', () => {
    const props = reactive<CalendarGeographyProps>({
      modelValue: {
        название: 'Календарь Империи',
        дней_в_неделе: 7,
        названия_дней_недели: [],
        первый_месяц_года: 0,
        месяцы: [],
        эпохи: [],
        region_ids: ['reg_1'],
        timezone_ids: ['tz_1']
      },
      planet: {
        id: 'earth',
        project_id: 'proj',
        name: 'Земля',
        ticks_per_day: 86400,
        orbit_days: 365.2422,
        regions: [
          { id: 'reg_1', name: 'Столица', timezone_id: 'tz_1', latitude: 55, longitude: 37 },
          { id: 'reg_2', name: 'Порт', timezone_id: 'tz_2', latitude: 45, longitude: 20 },
        ],
        timezones: [
          { id: 'tz_1', name: 'UTC+3', base_offset_hours: 3 },
          { id: 'tz_2', name: 'UTC+2', base_offset_hours: 2 },
        ]
      }
    });

    const emit = vi.fn();
    const hook = useCalendarGeography(props, emit);

    expect(hook.selectedRegions.value.length).toBe(1);
    expect(hook.selectedRegions.value[0].name).toBe('Столица');

    expect(hook.unselectedRegions.value.length).toBe(1);
    expect(hook.unselectedRegions.value[0].name).toBe('Порт');

    expect(hook.selectedTimezones.value.length).toBe(1);
    expect(hook.selectedTimezones.value[0].name).toBe('UTC+3');

    // Add region
    hook.addRegion('reg_2');
    expect(props.modelValue.region_ids).toContain('reg_2');

    // Remove region
    hook.removeRegion('reg_1');
    expect(props.modelValue.region_ids).not.toContain('reg_1');

    // Add timezone
    hook.addTimezone('tz_2');
    expect(props.modelValue.timezone_ids).toContain('tz_2');

    // Remove timezone
    hook.removeTimezone('tz_1');
    expect(props.modelValue.timezone_ids).not.toContain('tz_1');
  });

  it('handles empty planet gracefully', () => {
    const props = reactive<CalendarGeographyProps>({
      modelValue: {
        название: 'Новый календарь',
        дней_в_неделе: 7,
        названия_дней_недели: [],
        первый_месяц_года: 0,
        месяцы: [],
        эпохи: []
      },
      planet: null
    });

    const hook = useCalendarGeography(props);

    expect(hook.availableRegions.value).toEqual([]);
    expect(hook.availableTimezones.value).toEqual([]);
    expect(hook.selectedRegions.value).toEqual([]);
    expect(hook.unselectedRegions.value).toEqual([]);
  });
});
