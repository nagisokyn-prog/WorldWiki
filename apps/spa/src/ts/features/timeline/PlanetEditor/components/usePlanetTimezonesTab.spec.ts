import { describe, it, expect } from 'vitest';
import { usePlanetTimezonesTab, DST_OPTIONS } from './usePlanetTimezonesTab';
import type { PlanetTimezonesTabProps } from './PlanetTimezonesTab.model';

describe('usePlanetTimezonesTab', () => {
  const props: PlanetTimezonesTabProps = {
    planet: {
      id: 'p1',
      name: 'Терра',
      solar_day_hours: 24,
      year_days: 365,
      axial_tilt_deg: 23.5,
      timezones: [
        { code: 'UTC', offset_hours: 0 },
        { code: 'EST', offset_hours: -5 },
      ],
      regions: [],
    } as any,
  };

  it('computes timezoneCodeOptions properly', () => {
    const { timezoneCodeOptions } = usePlanetTimezonesTab(props);
    expect(timezoneCodeOptions.value).toHaveLength(2);
    expect(timezoneCodeOptions.value[0]).toEqual({ value: 'UTC', label: 'UTC' });
    expect(timezoneCodeOptions.value[1]).toEqual({ value: 'EST', label: 'EST' });
  });

  it('provides dstOptions', () => {
    const { dstOptions } = usePlanetTimezonesTab(props);
    expect(dstOptions).toEqual(DST_OPTIONS);
  });
});
