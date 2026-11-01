import { computed } from 'vue';
import type { PlanetTimezonesTabProps } from './PlanetTimezonesTab.model';

export const DST_OPTIONS = [
  { value: 'none', label: '🚫 Без перевода (None)' },
  { value: 'eu', label: '🇪🇺 EU (+60м)' },
  { value: 'us', label: '🇺🇸 US (+60м)' },
] as const;

export function usePlanetTimezonesTab(props: PlanetTimezonesTabProps) {
  const dstOptions = DST_OPTIONS;

  const timezoneCodeOptions = computed(() =>
    (props.planet?.timezones || []).map((tz) => ({
      value: tz.code,
      label: tz.code,
    }))
  );

  return {
    dstOptions,
    timezoneCodeOptions,
  };
}
