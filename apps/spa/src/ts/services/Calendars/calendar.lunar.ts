import type {
  CalendarData,
  MoonConfig,
  MoonPhaseResult,
  DaylightResult,
  WorldMoment,
  WorldTimezone,
  WorldRegion,
  RegionSunStatus
} from './calendar.types';
import { CalendarCycles } from './calendar.cycles';

export class CalendarLunar {
  /**
   * Calculate Moon Phases
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
      учитывать_сезонную_длительность_дня: false
    };
    const minutesInDay = settings.часов_в_сутках * settings.минут_в_часе;

    return moons.map(moon => {
      const periodMinutes = moon.period_days * minutesInDay;
      let phase = ((absoluteMinute / periodMinutes) + moon.initial_phase) % 1.0;
      if (phase < 0) phase += 1.0;

      let emoji = '🌑';
      let name = moon.phase_names?.new || 'Новолуние';

      if (phase > 0.125 && phase <= 0.375) {
        emoji = '🌓'; name = moon.phase_names?.waxing || 'Растущая';
      } else if (phase > 0.375 && phase <= 0.625) {
        emoji = '🌕'; name = moon.phase_names?.full || 'Полнолуние';
      } else if (phase > 0.625 && phase <= 0.875) {
        emoji = '🌗'; name = moon.phase_names?.waning || 'Убывающая';
      }

      return {
        moon,
        phase,
        name,
        emoji,
        dayInCycle: (phase * moon.period_days)
      };
    });
  }

  /**
   * Calculate Daylight
   */
  public static calculateDaylight(absoluteMinute: number, calendar: CalendarData): DaylightResult | null {
    if (!calendar.настройки_времени?.учитывать_сезонную_длительность_дня) return null;
    if (!calendar.day_length_anchor) return null;

    const settings = calendar.настройки_времени;
    const minutesInDay = settings.часов_в_сутках * settings.минут_в_часе;
    const totalDaysInYear = CalendarCycles.getDaysInYear(calendar, 1);

    const daysSinceEpoch = Math.floor(absoluteMinute / minutesInDay);

    const progress = (daysSinceEpoch % totalDaysInYear) / totalDaysInYear;
    const wave = -Math.cos(progress * 2 * Math.PI);

    const summerMins = calendar.day_length_anchor.summer_solstice_hours * settings.минут_в_часе;
    const winterMins = calendar.day_length_anchor.winter_solstice_hours * settings.минут_в_часе;

    const midPoint = (summerMins + winterMins) / 2;
    const amplitude = (summerMins - winterMins) / 2;

    const dayLengthMinutes = midPoint + (wave * amplitude);

    const zenithMinute = (settings.часов_в_сутках / 2) * settings.минут_в_часе;
    const sunriseMinute = zenithMinute - (dayLengthMinutes / 2);
    const sunsetMinute = zenithMinute + (dayLengthMinutes / 2);

    const formatTime = (mins: number) => {
      const h = Math.floor(mins / settings.минут_в_часе);
      const m = Math.floor(mins % settings.минут_в_часе);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      sunrise: formatTime(sunriseMinute),
      sunset: formatTime(sunsetMinute),
      zenith: formatTime(zenithMinute),
      duration_hours: +(dayLengthMinutes / settings.минут_в_часе).toFixed(2)
    };
  }

  /**
   * Литературное форматирование светового дня (без терминов вроде «инсоляция»)
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
   * Получить смещение часового пояса в часах для конкретного мирового дня
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
   * Астрономический расчет положения солнца и фазы дня в регионе (по широте и долготе)
   */
  public static calculateSunForRegion(
    region: WorldRegion,
    moment: WorldMoment,
    calendar: CalendarData,
    timezones: WorldTimezone[] = []
  ): RegionSunStatus {
    const tz = timezones.find(t => t.id === region.timezone_id);
    const offsetHours = tz ? this.getTimezoneOffsetForDay(tz, moment.day_index) : 0;

    const daysInYear = CalendarCycles.getDaysInYear(calendar, 1) || 365;
    const lat = region.latitude || 0;
    const lon = region.longitude || 0;

    // Сезонный прогресс планеты
    const dayInYear = ((moment.day_index % daysInYear) + daysInYear) % daysInYear;
    const theta = (dayInYear / daysInYear) * 2 * Math.PI;

    // Длина дня в часах (от 12ч на экваторе до сезонной амплитуды по широте)
    const latRad = (lat * Math.PI) / 180;
    const seasonAmp = 8.0 * Math.sin(latRad);
    const durationHours = Math.max(2, Math.min(22, 12.0 + seasonAmp * (-Math.cos(theta))));

    // Истинный солнечный полдень по местному поясному времени
    const solarNoonLocalHours = 12.0 - (lon / 15) + offsetHours;
    const normalizedNoon = ((solarNoonLocalHours % 24) + 24) % 24;

    const halfDay = durationHours / 2;
    const sunriseHours = ((normalizedNoon - halfDay + 24) % 24);
    const sunsetHours = ((normalizedNoon + halfDay + 24) % 24);

    // Текущее местное поясное время в часах [0..24)
    const localFraction = (((moment.day_fraction + (offsetHours / 24)) % 1) + 1) % 1;
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
      note: `Солнечный полдень: ${fmt(normalizedNoon)}`
    };
  }
}
