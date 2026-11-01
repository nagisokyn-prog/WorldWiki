import { describe, it, expect, vi } from 'vitest';
import { useTab3AgeTimezoneSection, DEFAULT_TIMEZONES } from './useTab3AgeTimezoneSection';
import type { Tab3AgeTimezoneSectionProps } from './Tab3AgeTimezoneSection.model';

describe('useTab3AgeTimezoneSection', () => {
  const props: Tab3AgeTimezoneSectionProps = {
    ageRule: {
      age_at_birth: 0,
      step_on_new_year: false,
      year_only_calculation: false,
    },
    calendarTimezone: 'UTC+3',
    regionsList: [{ id: 'r1', name: 'Север' }],
    selectedRegions: ['r1'],
  };

  it('submits new region and resets input', () => {
    const emit = vi.fn();
    const { showAddRegion, newRegionName, submitNewRegion } = useTab3AgeTimezoneSection(props, emit as any);

    showAddRegion.value = true;
    newRegionName.value = 'Западные Земли';
    submitNewRegion();

    expect(emit).toHaveBeenCalledWith('add-region', 'Западные Земли');
    expect(newRegionName.value).toBe('');
    expect(showAddRegion.value).toBe(false);
  });

  it('uses default timezones when props.timezonesList is empty', () => {
    const emit = vi.fn();
    const { timezonesOptions } = useTab3AgeTimezoneSection(props, emit as any);
    expect(timezonesOptions.value).toEqual(DEFAULT_TIMEZONES);
  });

  it('uses custom timezones when provided', () => {
    const emit = vi.fn();
    const customTz = [{ value: 'LOR+0', label: 'Локальное время' }];
    const { timezonesOptions } = useTab3AgeTimezoneSection({
      ...props,
      timezonesList: customTz,
    }, emit as any);
    expect(timezonesOptions.value).toEqual(customTz);
  });
});
