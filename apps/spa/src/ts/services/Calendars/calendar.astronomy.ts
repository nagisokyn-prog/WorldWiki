/**
 * @file calendar.astronomy.ts
 * @description Астрономические, географические и световые расчеты календаря.
 */

import type {
  CalendarData,
  DaylightResult,
  LoreDateExplanation,
  MoonConfig,
  MoonPhaseResult,
  RegionSunStatus,
  SyncAnchorDate,
  WorldMoment,
  WorldRegion,
  WorldTimezone,
} from './calendar.types';
import type { CalendarDateParts, CalendarDateInput } from './useCalendarEngine';
import { defaultWasmEngine as defaultEngine } from './calendar.wasm-bridge';

export const CalendarAstronomy = {
  calculateDaylight(
    absMin: number,
    cal: CalendarData,
    getDaysInYear: (c: CalendarData, y: number) => number
  ): DaylightResult | null {
    if (!cal?.настройки_времени?.учитывать_сезонную_длительность_дня) return null;
    const anchor = cal.day_length_anchor || { summer_solstice_hours: 16, winter_solstice_hours: 8 };
    const hInDay = cal.настройки_времени.часов_в_сутках || 24;
    const mInHour = cal.настройки_времени.минут_в_часе || 60;
    const avg = (anchor.summer_solstice_hours + anchor.winter_solstice_hours) / 2;
    const amp = (anchor.summer_solstice_hours - anchor.winter_solstice_hours) / 2;
    const yearMins = getDaysInYear(cal, 1) * hInDay * mInHour;
    const progress = (absMin % yearMins) / yearMins;
    const duration = avg + amp * Math.sin(progress * 2 * Math.PI);
    const half = duration / 2;
    const noon = hInDay / 2;
    const sunrise = Math.max(0, noon - half);
    const sunset = Math.min(hInDay, noon + half);
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
    return {
      sunrise: `${pad(Math.floor(sunrise))}:${pad(Math.floor((sunrise - Math.floor(sunrise)) * mInHour))}`,
      sunset: `${pad(Math.floor(sunset))}:${pad(Math.floor((sunset - Math.floor(sunset)) * mInHour))}`,
      zenith: `${pad(Math.floor(noon))}:00`,
      duration_hours: duration,
    };
  },

  formatDaylightLiterary(
    daylight?: DaylightResult | null
  ): { duration: string; sunrise: string; sunset: string } | null {
    if (!daylight) return null;
    const hours = Math.floor(daylight.duration_hours);
    const mins = Math.round((daylight.duration_hours - hours) * 60);
    return {
      duration: `Световой день: ${hours} ч ${mins} мин`,
      sunrise: `Восход: ${daylight.sunrise}`,
      sunset: `Закат: ${daylight.sunset}`,
    };
  },

  calculateMoonPhases(absMin: number, moons: MoonConfig[], cal?: CalendarData): MoonPhaseResult[] {
    if (!moons || moons.length === 0) return [];
    const settings = cal?.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;

    return moons.map((m: MoonConfig) => {
      const periodNum = m.period_days_num || Math.round((m.period_days || 28) * 1000);
      const periodDen = m.period_days_den || 1000;
      const initialPhaseBp = m.initial_phase_bp ?? Math.round(((m.initial_phase || 0) * 10000) % 10000);

      const res = defaultEngine.moon_phase_rational(
        BigInt(absMin),
        BigInt(minsInDay),
        BigInt(periodNum),
        BigInt(periodDen),
        BigInt(initialPhaseBp)
      );

      const phaseFrac = res.basis_points / 10000;
      let phaseKey: 'new' | 'waxing' | 'full' | 'waning';
      let defaultName: string;
      let defaultEmoji: string;

      if (phaseFrac < 0.05 || phaseFrac >= 0.95) {
        phaseKey = 'new';
        defaultName = 'Новолуние';
        defaultEmoji = '🌑';
      } else if (phaseFrac < 0.45) {
        phaseKey = 'waxing';
        defaultName = 'Растущая';
        defaultEmoji = '🌓';
      } else if (phaseFrac <= 0.55) {
        phaseKey = 'full';
        defaultName = 'Полнолуние';
        defaultEmoji = '🌕';
      } else {
        phaseKey = 'waning';
        defaultName = 'Убывающая';
        defaultEmoji = '🌗';
      }

      const phaseName = m.phase_names?.[phaseKey] || defaultName;

      return {
        moon: m,
        phase: phaseFrac,
        name: phaseName,
        phaseName,
        emoji: defaultEmoji,
        dayInCycle: phaseFrac * (periodNum / periodDen),
      };
    });
  },

  getTimezoneOffsetForDay(tz: WorldTimezone, dayIndex: number): number {
    if (tz.historical_rules && tz.historical_rules.length > 0) {
      for (const rule of tz.historical_rules) {
        const start = rule.start_world_day ?? -Infinity;
        const end = rule.end_world_day ?? Infinity;
        if (dayIndex >= start && dayIndex <= end) {
          return rule.offset_hours;
        }
      }
    }
    return tz.base_offset_hours || 0;
  },

  dateToWorldMoment(
    date: CalendarDateInput,
    cal: CalendarData,
    getAbsMinute: (d: CalendarDateInput, c: CalendarData) => number,
    offsetHours: number = 0
  ): WorldMoment {
    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;
    const absMin = getAbsMinute(date, cal) - offsetHours * mInHour;
    const day_index = Math.floor(absMin / minsInDay);
    const day_fraction = (((absMin % minsInDay) + minsInDay) % minsInDay) / minsInDay;
    return {
      day_index,
      day_fraction,
    };
  },

  worldMomentToDate(
    moment: WorldMoment,
    cal: CalendarData,
    getDateFromAbs: (absMin: number, c: CalendarData, eraIndex: number) => SyncAnchorDate,
    offsetHours: number = 0
  ): SyncAnchorDate {
    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;
    const totalMin = Math.round(moment.day_index * minsInDay + moment.day_fraction * minsInDay + offsetHours * mInHour);
    return getDateFromAbs(totalMin, cal, 0);
  },

  calculateSunForRegion(
    region: WorldRegion,
    moment: WorldMoment,
    cal: CalendarData,
    calcDaylight: (absMin: number, c: CalendarData) => DaylightResult | null
  ): RegionSunStatus {
    const daylight = calcDaylight(Math.round(moment.day_index * 1440 + moment.day_fraction * 1440), cal);
    const frac = moment.day_fraction;
    const getSunPhase = (f: number): { phase: 'dawn' | 'day' | 'dusk' | 'night'; phase_label: string } => {
      if (f >= 0.22 && f < 0.28) {
        return { phase: 'dawn', phase_label: '🌅 Рассвет' };
      }
      if (f >= 0.28 && f < 0.72) {
        return { phase: 'day', phase_label: '☀️ День' };
      }
      if (f >= 0.72 && f < 0.78) {
        return { phase: 'dusk', phase_label: '🌇 Закат' };
      }
      return { phase: 'night', phase_label: '🌙 Ночь' };
    };

    const { phase, phase_label } = getSunPhase(frac);

    const sunrise_time = daylight?.sunrise || '06:00';
    const sunset_time = daylight?.sunset || '18:00';
    const zenith_time = daylight?.zenith || '12:00';
    const daylight_text = daylight
      ? `Световой день ~${Math.round(daylight.duration_hours)} ч.`
      : 'Стандартный световой день (~12 ч.)';

    return {
      phase,
      phase_label,
      daylight_text,
      sunrise_time,
      sunset_time,
      zenith_time,
      note: region.name ? `Регион: ${region.name}` : undefined,
    };
  },

  explainDate(
    date: CalendarDateParts,
    cal: CalendarData,
    allCals: CalendarData[],
    masterCal: CalendarData,
    ops: {
      formatDate: (c: CalendarData, d: { original_input?: CalendarDateParts }) => string;
      localDateToMasterMinute: (d: CalendarDateInput, l?: CalendarData | null, m?: CalendarData | null) => number;
      getDateFromAbsolute: (absMin: number, c: CalendarData, eraIndex: number) => SyncAnchorDate;
      masterMinuteToLocalDate: (absMin: number, l?: CalendarData | null, m?: CalendarData | null, eraIndex?: number) => SyncAnchorDate;
      calculateDaylight: (absMin: number, c: CalendarData) => DaylightResult | null;
      getSeasonForDate: (c: CalendarData, y: number, m: number) => string;
      isHoliday: (c: CalendarData, y: number, m: number, d: number) => boolean;
    }
  ): LoreDateExplanation {
    const localFormatted = ops.formatDate(cal, { original_input: date });
    const masterMin = ops.localDateToMasterMinute(date, cal, masterCal);
    const masterDate = ops.getDateFromAbsolute(masterMin, masterCal, 0);
    const masterFormatted = ops.formatDate(masterCal, { original_input: masterDate });
    const crossDates = allCals
      .filter((c) => c._id !== cal._id && c._id !== masterCal._id)
      .map((c) => {
        const d = ops.masterMinuteToLocalDate(masterMin, c, masterCal, 0);
        return {
          calendarName: c.название,
          formatted: ops.formatDate(c, { original_input: d }),
        };
      });

    const moons = this.calculateMoonPhases(masterMin, cal.moons || [], cal);
    const daylight = ops.calculateDaylight(masterMin, cal);
    const season = ops.getSeasonForDate(cal, date.year ?? 1, date.month ?? 0);
    const isHoliday = ops.isHoliday(cal, date.year ?? 1, date.month ?? 0, date.day ?? 1);
    const holidays = isHoliday ? ['Праздничный день'] : [];

    const moonSnippet = moons.length > 0 ? `на небе сияла ${moons[0].name}` : '';
    const snippet = `Шёл ${localFormatted} (${season}), что соответствовало ${masterFormatted} по Календарю Мира.${moonSnippet ? ' ' + moonSnippet + '.' : ''}`;

    return {
      masterDateFormatted: masterFormatted,
      localDateFormatted: localFormatted,
      crossDates,
      moons,
      daylightText: daylight ? `Световой день: ~${Math.round(daylight.duration_hours)} ч.` : undefined,
      sunriseText: daylight ? `Восход: ${daylight.sunrise}` : undefined,
      sunsetText: daylight ? `Закат: ${daylight.sunset}` : undefined,
      holidays,
      snippet,
    };
  },
};
