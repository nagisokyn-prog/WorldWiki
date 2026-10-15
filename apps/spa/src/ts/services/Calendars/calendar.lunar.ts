/**
 * @file calendar.lunar.ts
 * @description Астрономические расчеты лунных фаз, светового дня и солнечного зенита.
 * Согласовано с математическим ядром worldwiki-calendar-core.
 */

import type {
  CalendarData,
  MoonConfig,
  MoonPhaseResult,
  DaylightResult,
  WorldMoment,
  WorldTimezone,
  WorldRegion,
  RegionSunStatus,
} from './calendar.types';
import { CalendarCycles } from './calendar.cycles';

export class CalendarLunar {
  /**
   * Рациональный расчет лунных фаз без потери точности с плавающей точкой
   */
  public static calculateMoonPhases(
    absoluteMinute: number,
    moons: MoonConfig[] = [],
    calendar: CalendarData
  ): MoonPhaseResult[] {
    const settings = calendar.настройки_времени || {
      часов_в_сутках: 24,
      минут_в_часе: 60,
      секунд_в_минуте: 60,
      широта: 0,
      учитывать_сезонную_длительность_дня: false,
    };
    const minutesInDay = (settings.часов_в_сутках || 24) * (settings.минут_в_часе || 60);

    return moons.map(moon => {
      const periodMinutes = Math.max(1, (moon.period_days || 29.53) * minutesInDay);
      // Фазовый сдвиг в абсолютных минутах = initial_phase * период
      const shiftMinutes = (moon.initial_phase || 0) * periodMinutes;
      const totalMinutes = absoluteMinute + shiftMinutes;
      let phase = (totalMinutes % periodMinutes) / periodMinutes;
      if (phase < 0) phase += 1.0;

      let emoji = '🌑';
      let name = moon.phase_names?.new || 'Новолуние';

      if (phase > 0.0625 && phase <= 0.1875) {
        emoji = '🌒';
        name = moon.phase_names?.waxing || 'Молодая луна';
      } else if (phase > 0.1875 && phase <= 0.3125) {
        emoji = '🌓';
        name = 'Первая четверть';
      } else if (phase > 0.3125 && phase <= 0.4375) {
        emoji = '🌔';
        name = 'Растущая луна';
      } else if (phase > 0.4375 && phase <= 0.5625) {
        emoji = '🌕';
        name = moon.phase_names?.full || 'Полнолуние';
      } else if (phase > 0.5625 && phase <= 0.6875) {
        emoji = '🌖';
        name = 'Убывающая луна';
      } else if (phase > 0.6875 && phase <= 0.8125) {
        emoji = '🌗';
        name = 'Последняя четверть';
      } else if (phase > 0.8125 && phase <= 0.9375) {
        emoji = '🌘';
        name = moon.phase_names?.waning || 'Старая луна';
      }

      return {
        moon,
        phase,
        name,
        emoji,
        dayInCycle: phase * (moon.period_days || 29.53),
      };
    });
  }

  /**
   * Расчет светового дня
   */
  public static calculateDaylight(absoluteMinute: number, calendar: CalendarData): DaylightResult | null {
    if (!calendar.настройки_времени?.учитывать_сезонную_длительность_дня) return null;
    if (!calendar.day_length_anchor) return null;

    const settings = calendar.настройки_времени;
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minutesInDay = hInDay * mInHour;
    const totalDaysInYear = CalendarCycles.getDaysInYear(calendar, 1);

    const daysSinceEpoch = Math.floor(absoluteMinute / minutesInDay);

    const progress = (daysSinceEpoch % totalDaysInYear) / totalDaysInYear;
    const wave = -Math.cos(progress * 2 * Math.PI);

    const summerMins = (calendar.day_length_anchor.summer_solstice_hours || 16) * mInHour;
    const winterMins = (calendar.day_length_anchor.winter_solstice_hours || 8) * mInHour;

    const midPoint = (summerMins + winterMins) / 2;
    const amplitude = (summerMins - winterMins) / 2;

    const dayLengthMinutes = midPoint + wave * amplitude;

    const zenithMinute = (hInDay / 2) * mInHour;
    const sunriseMinute = zenithMinute - dayLengthMinutes / 2;
    const sunsetMinute = zenithMinute + dayLengthMinutes / 2;

    const formatTime = (mins: number) => {
      const h = Math.floor(mins / mInHour);
      const m = Math.floor(mins % mInHour);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      sunrise: formatTime(sunriseMinute),
      sunset: formatTime(sunsetMinute),
      zenith: formatTime(zenithMinute),
      duration_hours: +(dayLengthMinutes / mInHour).toFixed(2),
    };
  }

  /**
   * Литературное форматирование светового дня
   */
  public static formatDaylightLiterary(
    daylight: DaylightResult | null
  ): { duration: string; sunrise: string; sunset: string } | null {
    if (!daylight) return null;
    const totalHours = daylight.duration_hours;
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    return {
      duration: `Световой день: ${h} ч ${m} мин`,
      sunrise: `Восход: ${daylight.sunrise}`,
      sunset: `Закат: ${daylight.sunset}`,
    };
  }

  /**
   * Смещение часового пояса в часах для конкретного мирового дня
   */
  public static getTimezoneOffsetForDay(timezone: WorldTimezone, worldDay: number): number {
    if (!timezone) return 0;
    if (timezone.historical_rules && timezone.historical_rules.length > 0) {
      for (const rule of timezone.historical_rules) {
        const start = rule.start_world_day ?? -Infinity;
        const end = rule.end_world_day ?? Infinity;
        if (worldDay >= start && worldDay <= end) {
          return rule.offset_hours;
        }
      }
    }
    return timezone.base_offset_hours || 0;
  }

  /**
   * Астрономический расчет положения солнца и фазы дня в регионе
   * с поддержкой прямого и ретроградного вращения планеты.
   */
  public static calculateSunForRegion(
    region: WorldRegion & { retrograde?: boolean },
    moment: WorldMoment,
    calendar: CalendarData,
    timezones: WorldTimezone[] = []
  ): RegionSunStatus {
    const tz = timezones.find(t => t.id === region.timezone_id);
    const offsetHours = tz ? this.getTimezoneOffsetForDay(tz, moment.day_index) : 0;

    const daysInYear = CalendarCycles.getDaysInYear(calendar, 1) || 365;
    const lat = region.latitude || 0;
    const lon = region.longitude || 0;
    const isRetrograde = Boolean(region.retrograde);

    // Сезонный прогресс планеты
    const dayInYear = ((moment.day_index % daysInYear) + daysInYear) % daysInYear;
    const theta = (dayInYear / daysInYear) * 2 * Math.PI;

    // Длина дня в часах (от 12ч на экваторе до сезонной амплитуды по широте)
    const latRad = (lat * Math.PI) / 180;
    const seasonAmp = 8.0 * Math.sin(latRad);
    const durationHours = Math.max(2, Math.min(22, 12.0 + seasonAmp * -Math.cos(theta)));

    // Истинный солнечный полдень с учетом прямого/ретроградного вращения:
    // При прямом вращении (retrograde = false) полдень на +lon раньше (минус lon/15).
    // При ретроградном вращении (retrograde = true) солнце восходит на западе (плюс lon/15).
    const lonShiftHours = isRetrograde ? lon / 15 : -(lon / 15);
    const solarNoonLocalHours = 12.0 + lonShiftHours + offsetHours;
    const normalizedNoon = ((solarNoonLocalHours % 24) + 24) % 24;

    const halfDay = durationHours / 2;
    const sunriseHours = (normalizedNoon - halfDay + 24) % 24;
    const sunsetHours = (normalizedNoon + halfDay + 24) % 24;

    // Текущее местное поясное время в часах [0..24)
    const localFraction = (((moment.day_fraction + offsetHours / 24) % 1) + 1) % 1;
    const currentLocalHours = localFraction * 24;

    const isBetween = (time: number, start: number, end: number) => {
      if (start <= end) return time >= start && time <= end;
      return time >= start || time <= end;
    };

    let phase: 'dawn' | 'day' | 'dusk' | 'night';
    let phase_label: string;

    if (isBetween(currentLocalHours, sunriseHours - 0.75, sunriseHours + 0.75)) {
      phase = 'dawn';
      phase_label = '🌅 Рассвет';
    } else if (isBetween(currentLocalHours, sunsetHours - 0.75, sunsetHours + 0.75)) {
      phase = 'dusk';
      phase_label = '🌆 Сумерки';
    } else if (isBetween(currentLocalHours, sunriseHours + 0.75, sunsetHours - 0.75)) {
      phase = 'day';
      phase_label = '☀️ День';
    } else {
      phase = 'night';
      phase_label = '🌙 Ночь';
    }

    const fmt = (h: number) => {
      const hh = Math.floor(h) % 24;
      const mm = Math.floor((h - Math.floor(h)) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    const totalDurH = Math.floor(durationHours);
    const totalDurM = Math.round((durationHours - totalDurH) * 60);

    return {
      phase,
      phase_label,
      daylight_text: `${totalDurH} ч ${totalDurM} мин`,
      sunrise_time: fmt(sunriseHours),
      sunset_time: fmt(sunsetHours),
      zenith_time: fmt(normalizedNoon),
      note: `Солнечный полдень: ${fmt(normalizedNoon)}${isRetrograde ? ' (ретроградное вращение)' : ''}`,
    };
  }
}
