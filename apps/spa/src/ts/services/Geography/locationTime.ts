import { CalendarMath } from '../Calendars/useCalendarEngine';
import type {
  CalendarData,
  RegionSunStatus,
  WorldMoment,
  WorldRegion,
  WorldTimezone,
} from '../Calendars/calendar.types';
import type { ComputedLocationTime, ResolvedLocationGeography } from './locationHierarchy.types';

export function getSunPhaseEmoji(phase: RegionSunStatus['phase']): string {
  if (phase === 'dawn') return '🌅';
  if (phase === 'day') return '☀️';
  if (phase === 'dusk') return '🌇';
  return '🌙';
}

export function computeLocationLocalTime(
  mAbs: number,
  geo: ResolvedLocationGeography,
  masterCalendar: CalendarData | null,
  timezones: WorldTimezone[] = []
): ComputedLocationTime {
  const settings = masterCalendar?.настройки_времени || {
    часов_в_сутках: 24,
    минут_в_часе: 60,
    секунд_в_минуте: 60,
    широта: 0,
    учитывать_сезонную_длительность_дня: true,
  };
  const hoursPerDay = settings.часов_в_сутках || 24;
  const minsPerHour = settings.минут_в_часе || 60;
  const dayMins = hoursPerDay * minsPerHour;
  const dayIndex = dayMins > 0 ? Math.floor(mAbs / dayMins) : 0;
  const remMins = dayMins > 0 ? ((mAbs % dayMins) + dayMins) % dayMins : 0;
  const moment: WorldMoment = { day_index: dayIndex, day_fraction: dayMins > 0 ? remMins / dayMins : 0 };

  const worldHour = Math.floor(remMins / minsPerHour);
  const worldMin = Math.floor(remMins % minsPerHour);
  const worldTimeStr = `${String(worldHour).padStart(2, '0')}:${String(worldMin).padStart(2, '0')}`;

  if (!masterCalendar) {
    const shiftedMins = (((remMins + Math.round(geo.offsetHours * minsPerHour)) % dayMins) + dayMins) % dayMins;
    const lHour = Math.floor(shiftedMins / minsPerHour);
    const lMin = Math.floor(shiftedMins % minsPerHour);
    const localTimeStr = `${String(lHour).padStart(2, '0')}:${String(lMin).padStart(2, '0')}`;
    const phase: RegionSunStatus['phase'] =
      lHour >= 5 && lHour < 7 ? 'dawn' : lHour >= 7 && lHour < 19 ? 'day' : lHour >= 19 && lHour < 21 ? 'dusk' : 'night';
    const sunStatus: RegionSunStatus = {
      phase,
      phase_label: lHour >= 6 && lHour < 20 ? 'День' : 'Ночь',
      daylight_text: '12 ч 00 мин',
      sunrise_time: '06:00',
      sunset_time: '18:00',
      zenith_time: '12:00',
    };
    const hasDisc = Math.abs(geo.offsetHours) >= 1;
    return {
      offsetHours: geo.offsetHours,
      localTimeStr,
      localDateFormatted: `День ${dayIndex}`,
      worldTimeStr,
      sunStatus,
      phaseEmoji: getSunPhaseEmoji(phase),
      hasDiscrepancy: hasDisc,
      discrepancyHint: hasDisc
        ? `Местное время в «${geo.entityName}»: ${localTimeStr} (UTC${geo.offsetHours >= 0 ? '+' : ''}${geo.offsetHours}), мировое: ${worldTimeStr}`
        : null,
    };
  }

  const localInput = CalendarMath.worldMomentToDate(moment, masterCalendar, geo.offsetHours);
  const localDateFormatted = CalendarMath.formatDate(masterCalendar, {
    absolute_minute: mAbs,
    calendar_id: masterCalendar._id || 'master',
    original_input: localInput,
  });
  const localTimeStr = `${String(localInput.hour ?? 0).padStart(2, '0')}:${String(localInput.minute ?? 0).padStart(2, '0')}`;
  const synthRegion: WorldRegion = {
    id: `loc_${geo.entityId}`,
    name: geo.entityName,
    timezone_id: geo.timezoneId || 'tz_utc',
    latitude: geo.latitude ?? settings.широта ?? 0,
    longitude: geo.longitude ?? geo.offsetHours * 15,
  };
  const sunStatus = CalendarMath.calculateSunForRegion(synthRegion, moment, masterCalendar, timezones, geo.offsetHours);
  const worldRegion: WorldRegion = {
    id: 'world_prime',
    name: 'Нулевой меридиан',
    timezone_id: 'tz_utc',
    latitude: settings.широта ?? 0,
    longitude: 0,
  };
  const worldSun = CalendarMath.calculateSunForRegion(worldRegion, moment, masterCalendar, timezones, 0);
  const hasDiscrepancy = Math.abs(geo.offsetHours) >= 1 || sunStatus.phase !== worldSun.phase;
  const sign = geo.offsetHours >= 0 ? '+' : '';

  return {
    offsetHours: geo.offsetHours,
    localTimeStr,
    localDateFormatted,
    worldTimeStr,
    sunStatus,
    phaseEmoji: getSunPhaseEmoji(sunStatus.phase),
    hasDiscrepancy,
    discrepancyHint: hasDiscrepancy
      ? `В локации «${geo.entityName}» (UTC${sign}${geo.offsetHours}) сейчас ${localTimeStr} (${sunStatus.phase_label}), тогда как по мировому времени ${worldTimeStr} (${worldSun.phase_label}).`
      : null,
  };
}

