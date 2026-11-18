import type {
  CalendarData,
  DaylightResult,
  RegionSunStatus,
  WorldMoment,
  WorldRegion,
} from './calendar.types';

/** Рассчитывает фазу дня, восход, закат и длительность светового дня для региона планеты. */
export function computeRegionSunStatus(
  region: WorldRegion,
  moment: WorldMoment,
  cal: CalendarData,
  calcDaylight: (absMin: number, c: CalendarData) => DaylightResult | null,
  offsetHours: number = 0
): RegionSunStatus {
  const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
  const hInDay = settings.часов_в_сутках || 24;
  const mInHour = settings.минут_в_часе || 60;
  const minsInDay = hInDay * mInHour;
  const localFrac = (((moment.day_fraction + offsetHours / hInDay) % 1) + 1) % 1;
  const localHours = localFrac * hInDay;

  const formatClock = (hoursVal: number): string => {
    const norm = ((hoursVal % hInDay) + hInDay) % hInDay;
    const totalMins = Math.round(norm * mInHour) % minsInDay;
    const hh = Math.floor(totalMins / mInHour);
    const mm = totalMins % mInHour;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const parseClockHours = (clockStr: string): number => {
    const [h, m] = clockStr.split(':').map(Number);
    return (h || 0) + (m || 0) / mInHour;
  };

  const degPerHour = 360 / hInDay;
  const stdMeridian = offsetHours * degPerHour;
  const lonOffsetHours =
    region.longitude !== undefined && region.longitude !== null
      ? (stdMeridian - region.longitude) / degPerHour
      : 0;
  const noonHours = (((hInDay / 2 + lonOffsetHours) % hInDay) + hInDay) % hInDay;

  const yearDays = cal.месяцы?.reduce((acc, m) => acc + (m.дней || 0), 0) || 365;
  const dayOfYear = ((moment.day_index % yearDays) + yearDays) % yearDays;
  const hemisphereSign = region.latitude !== undefined && region.latitude < 0 ? -1 : 1;
  const seasonFactor = -Math.cos((2 * Math.PI * (dayOfYear + 10)) / yearDays) * hemisphereSign;

  let durationHours: number;
  let sunriseHours: number;
  let sunsetHours: number;
  let sunrise_time: string;
  let sunset_time: string;
  let zenith_time: string;
  let hasCustomDaylight = false;

  if (region.summer_day_hours != null && region.winter_day_hours != null) {
    hasCustomDaylight = true;
    const avg = (region.summer_day_hours + region.winter_day_hours) / 2;
    const amp = (region.summer_day_hours - region.winter_day_hours) / 2;
    durationHours = Math.max(0, Math.min(hInDay, avg + amp * seasonFactor));
    sunriseHours = (((noonHours - durationHours / 2) % hInDay) + hInDay) % hInDay;
    sunsetHours = (((noonHours + durationHours / 2) % hInDay) + hInDay) % hInDay;
    sunrise_time = formatClock(sunriseHours);
    sunset_time = formatClock(sunsetHours);
    zenith_time = formatClock(noonHours);
  } else if (region.latitude != null && region.latitude !== 0) {
    hasCustomDaylight = true;
    const absLat = Math.min(66.5, Math.abs(region.latitude));
    const amp = (hInDay / 2) * Math.sin((absLat * Math.PI) / 180) * 0.75;
    durationHours = Math.max(0, Math.min(hInDay, hInDay / 2 + amp * seasonFactor));
    sunriseHours = (((noonHours - durationHours / 2) % hInDay) + hInDay) % hInDay;
    sunsetHours = (((noonHours + durationHours / 2) % hInDay) + hInDay) % hInDay;
    sunrise_time = formatClock(sunriseHours);
    sunset_time = formatClock(sunsetHours);
    zenith_time = formatClock(noonHours);
  } else {
    const daylight = calcDaylight(Math.round(moment.day_index * minsInDay + localFrac * minsInDay), cal);
    if (daylight) {
      hasCustomDaylight = true;
      durationHours = daylight.duration_hours;
      sunrise_time = daylight.sunrise;
      sunset_time = daylight.sunset;
      zenith_time = daylight.zenith;
      sunriseHours = parseClockHours(daylight.sunrise);
      sunsetHours = parseClockHours(daylight.sunset);
    } else {
      durationHours = hInDay / 2;
      sunriseHours = hInDay * 0.25;
      sunsetHours = hInDay * 0.75;
      sunrise_time = formatClock(sunriseHours);
      sunset_time = formatClock(sunsetHours);
      zenith_time = formatClock(noonHours);
    }
  }

  const circularDist = (a: number, b: number): number => {
    const d = Math.abs(a - b) % hInDay;
    return Math.min(d, hInDay - d);
  };

  const resolvePhase = (): { phase: 'dawn' | 'day' | 'dusk' | 'night'; phase_label: string } => {
    if (durationHours >= hInDay - 0.01) return { phase: 'day', phase_label: '☀️ День' };
    if (durationHours <= 0.01) return { phase: 'night', phase_label: '🌙 Ночь' };
    const twilight = hInDay * 0.03;
    if (circularDist(localHours, sunriseHours) <= twilight) return { phase: 'dawn', phase_label: '🌅 Рассвет' };
    if (circularDist(localHours, sunsetHours) <= twilight) return { phase: 'dusk', phase_label: '🌇 Закат' };
    const sinceSunrise = (((localHours - sunriseHours) % hInDay) + hInDay) % hInDay;
    return sinceSunrise < durationHours
      ? { phase: 'day', phase_label: '☀️ День' }
      : { phase: 'night', phase_label: '🌙 Ночь' };
  };

  const { phase, phase_label } = resolvePhase();
  return {
    phase,
    phase_label,
    daylight_text: hasCustomDaylight
      ? `Световой день ~${Math.round(durationHours)} ч.`
      : 'Стандартный световой день (~12 ч.)',
    sunrise_time,
    sunset_time,
    zenith_time,
    note: region.name ? `Регион: ${region.name}` : undefined,
  };
}
