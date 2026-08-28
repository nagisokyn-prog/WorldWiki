import type { CalendarData, CalendarDate, MoonConfig, MoonPhaseResult, DaylightResult, SyncAnchorDate } from '../Calendars/calendar.types';

export class CalendarMath {

  /**
   * Helper: check leap year
   */
  public static isLeapYear(calendar: CalendarData, year: number): boolean {
    const rule = calendar.правило_високосного_года;
    if (rule === 'григорианское' || rule === 'каждый 4 год') {
      if (rule === 'григорианское') {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      }
      return year % 4 === 0;
    }
    return false; // Assuming false for custom rule if not implemented here fully
  }

  /**
   * Get days in year
   */
  public static getDaysInYear(calendar: CalendarData, year: number): number {
    let days = 0;
    for (let i = 0; i < calendar.месяцы.length; i++) {
      let mDays = calendar.месяцы[i].дней;
      const leapRule = calendar.пользовательское_високосное_правило;
      if (leapRule && leapRule.месяц === i && this.isLeapYear(calendar, year)) {
        mDays += leapRule.день_смещения;
      }
      days += mDays;
    }
    return days;
  }

  /**
   * Convert Date Object to Absolute Minute
   */
  public static getAbsoluteMinute(input: CalendarDate['original_input'], calendar: CalendarData): number {
    const { era_index, year, month, day, hour = 0, minute = 0 } = input;
    const settings = calendar.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60, секунд_в_минуте: 60, широта: 0, учитывать_сезонную_длительность_дня: false };

    const minutesInDay = settings.часов_в_сутках * settings.минут_в_часе;

    let totalDays = 0;

    const era = calendar.эпохи[era_index];
    const isReverse = era?.обратный_отсчет;

    const actualYear = isReverse ? -year : year;

    if (actualYear > 1) {
      for (let y = 1; y < actualYear; y++) {
        totalDays += this.getDaysInYear(calendar, y);
      }
    } else if (actualYear < 1) {
      for (let y = 0; y >= actualYear; y--) {
        totalDays -= this.getDaysInYear(calendar, y);
      }
    }

    for (let m = 0; m < month; m++) {
      let mDays = calendar.месяцы[m].дней;
      const leapRule = calendar.пользовательское_високосное_правило;
      if (leapRule && leapRule.месяц === m && this.isLeapYear(calendar, actualYear)) {
        mDays += leapRule.день_смещения;
      }
      totalDays += mDays;
    }

    totalDays += (day - 1);

    let absMinute = totalDays * minutesInDay;
    absMinute += hour * settings.минут_в_часе;
    absMinute += minute;

    return absMinute;
  }

  /**
   * Convert Absolute Minute to Date Object
   */
  public static getDateFromAbsolute(absoluteMinute: number, calendar: CalendarData, era_index: number = 1): CalendarDate['original_input'] {
    const settings = calendar.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60, секунд_в_минуте: 60, широта: 0, учитывать_сезонную_длительность_дня: false };
    const minutesInDay = settings.часов_в_сутках * settings.минут_в_часе;

    let totalDays = Math.floor(absoluteMinute / minutesInDay);
    let remainderMinutes = absoluteMinute % minutesInDay;
    if (remainderMinutes < 0) {
      remainderMinutes += minutesInDay;
      totalDays -= 1;
    }

    const hour = Math.floor(remainderMinutes / settings.минут_в_часе);
    const minute = remainderMinutes % settings.минут_в_часе;

    let year = 1;
    if (totalDays >= 0) {
      while (true) {
        const yDays = this.getDaysInYear(calendar, year);
        if (totalDays >= yDays) {
          totalDays -= yDays;
          year++;
        } else {
          break;
        }
      }
    } else {
      year = 0;
      while (true) {
        const yDays = this.getDaysInYear(calendar, year);
        if (totalDays < 0) {
          totalDays += yDays;
          year--;
        } else {
          break;
        }
      }
    }

    let month = 0;
    for (let m = 0; m < calendar.месяцы.length; m++) {
      let mDays = calendar.месяцы[m].дней;
      const leapRule = calendar.пользовательское_високосное_правило;
      if (leapRule && leapRule.месяц === m && this.isLeapYear(calendar, year)) {
        mDays += leapRule.день_смещения;
      }
      if (totalDays >= mDays) {
        totalDays -= mDays;
        month++;
      } else {
        break;
      }
    }

    const day = totalDays + 1;

    const era = calendar.эпохи[era_index];
    if (era?.обратный_отсчет) {
      year = -year;
    }

    return { era_index, year, month, day, hour, minute };
  }

  /**
   * Calculate Moon Phases
   */
  public static calculateMoonPhases(absoluteMinute: number, moons: MoonConfig[] = [], calendar: CalendarData): MoonPhaseResult[] {
    const settings = calendar.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60, секунд_в_минуте: 60, широта: 0, учитывать_сезонную_длительность_дня: false };
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
    const totalDaysInYear = this.getDaysInYear(calendar, 1);

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
   * Parse relative duration string ("2 года 4 месяца 1 день") -> absolute minutes
   */
  public static parseDurationString(input: string, calendar: CalendarData): number {
    const settings = calendar.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60, секунд_в_минуте: 60, широта: 0, учитывать_сезонную_длительность_дня: false };
    const minutesInDay = settings.часов_в_сутках * settings.минут_в_часе;

    let addDays = 0;

    const matchYears = input.match(/(\d+)\s*(год|лет|года)/i);
    if (matchYears) {
      addDays += parseInt(matchYears[1]) * this.getDaysInYear(calendar, 1);
    }

    const matchMonths = input.match(/(\d+)\s*(месяц|месяца|месяцев)/i);
    if (matchMonths) {
      addDays += parseInt(matchMonths[1]) * 30; // approx
    }

    const matchDays = input.match(/(\d+)\s*(день|дня|дней)/i);
    if (matchDays) {
      addDays += parseInt(matchDays[1]);
    }

    const matchHours = input.match(/(\d+)\s*(час|часа|часов)/i);
    let addMinutes = 0;
    if (matchHours) {
      addMinutes += parseInt(matchHours[1]) * settings.минут_в_часе;
    }

    return (addDays * minutesInDay) + addMinutes;
  }

  /**
   * Получить количество дней в месяце с учётом високосности
   */
  public static getDaysInMonth(calendar: CalendarData, year: number, monthIndex: number): number {
    if (!calendar || !calendar.месяцы) return 30;
    const month = calendar.месяцы[monthIndex];
    if (!month) return 30;
    let days = month.дней;
    const leapMonth = calendar.пользовательское_високосное_правило?.месяц;
    if (this.isLeapYear(calendar, year) && monthIndex === leapMonth) {
      days += 1;
    }
    return days;
  }

  /**
   * Проверка на праздник
   */
  public static isHoliday(calendar: CalendarData, year: number, monthIdx: number, day: number): boolean {
    if (!calendar || !calendar.праздники) return false;
    for (const h of calendar.праздники) {
      const sm = h.дата_начала.месяц, sd = h.дата_начала.день;
      const em = h.дата_конца?.месяц ?? sm, ed = h.дата_конца?.день ?? sd;
      if (monthIdx >= sm && monthIdx <= em) {
        if (monthIdx === sm && monthIdx === em) return day >= sd && day <= ed;
        if (monthIdx === sm) return day >= sd;
        if (monthIdx === em) return day <= ed;
        return true;
      }
    }
    return false;
  }

  /**
   * Получить сезон для даты
   */
  public static getSeasonForDate(calendar: CalendarData, year: number, monthIdx: number): string {
    if (!calendar || !calendar.сезоны?.length) return 'Вне сезона';
    for (const season of calendar.сезоны) {
      if (season.месяцы?.includes(monthIdx)) return season.название;
    }
    return 'Вне сезона';
  }

  /**
   * Форматирование даты в читаемую строку
   */
  public static formatDate(calendar: CalendarData, dateObj: CalendarDate): string {
    if (!dateObj || !dateObj.original_input) return '';
    const { era_index, year: год, month: месяц, day: день, hour, minute } = dateObj.original_input;
    if (год === undefined || месяц === undefined || день === undefined) return '';

    const era = calendar.эпохи[era_index];
    const eraName = era ? era.название : '';
    const monthName = calendar.месяцы[месяц]?.название || `Месяц ${месяц + 1}`;

    let result = `${год} год, ${monthName} ${день}`;
    if (eraName) result += ` (${eraName})`;
    
    if (hour !== undefined && minute !== undefined) {
      result += ` в ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    
    return result;
  }

  /**
   * Возвращает стандартный календарь по умолчанию
   */
  public static getDefaultCalendar(): CalendarData {
    return {
      название: 'Григорианский календарь',
      дней_в_неделе: 7,
      названия_дней_недели: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
      первый_месяц_года: 0,
      месяцы: [
        { название: 'Январь', дней: 31 },
        { название: 'Февраль', дней: 28 },
        { название: 'Март', дней: 31 },
        { название: 'Апрель', дней: 30 },
        { название: 'Май', дней: 31 },
        { название: 'Июнь', дней: 30 },
        { название: 'Июль', дней: 31 },
        { название: 'Август', дней: 31 },
        { название: 'Сентябрь', дней: 30 },
        { название: 'Октябрь', дней: 31 },
        { название: 'Ноябрь', дней: 30 },
        { название: 'Декабрь', дней: 31 }
      ],
      эпохи: [{ название: 'Наша эра', год_начала: 1, год_конца: 9999 }],
      правило_високосного_года: 'григорианское',
      пользовательское_високосное_правило: { месяц: 1, день_смещения: 29 },
      точка_отсчета: { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 },
      настройки_времени: {
        часов_в_сутках: 24,
        минут_в_часе: 60,
        секунд_в_минуте: 60,
        широта: 45.0,
        учитывать_сезонную_длительность_дня: false
      },
      сезоны: [],
      праздники: [],
      moons: [],
      weather_patterns: []
    };
  }

  /**
   * Получить название месяца по индексу
   */
  public static getMonthName(calendar: CalendarData, monthIndex: number): string {
    return calendar.месяцы[monthIndex]?.название || 'Неизвестный месяц';
  }

  /**
   * Получить название дня недели по индексу
   */
  public static getDayName(calendar: CalendarData, dayIndex: number): string {
    return calendar.названия_дней_недели[dayIndex] || 'День';
  }

  /**
   * Слияние данных календаря
   */
  public static mergeCalendarData(target: CalendarData, source: Partial<CalendarData>): CalendarData {
    const merged = JSON.parse(JSON.stringify(target)) as CalendarData;
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key) && Object.prototype.hasOwnProperty.call(merged, key)) {
        const sourceVal = (source as Record<string, unknown>)[key];
        const mergedVal = (merged as Record<string, unknown>)[key];
        if (typeof sourceVal === 'object' && sourceVal !== null && !Array.isArray(sourceVal) &&
            typeof mergedVal === 'object' && mergedVal !== null && !Array.isArray(mergedVal)) {
          (merged as Record<string, unknown>)[key] = { ...mergedVal, ...sourceVal };
        } else {
          (merged as Record<string, unknown>)[key] = sourceVal;
        }
      }
    }
    return merged;
  }

  /**
   * Вычислить смещение (в абсолютных минутах) между локальным и мастер-календарём.
   * master_minute = local_minute + offset
   */
  public static getAnchorOffset(localCal: CalendarData, masterCal?: CalendarData | null): number {
    if (!localCal || localCal.is_master || !localCal.sync_anchor?.linked_to_master) {
      return 0;
    }

    const anchor = localCal.sync_anchor;

    if (anchor.local_anchor_date && anchor.master_anchor_date && masterCal) {
      const localMin = this.getAbsoluteMinute(anchor.local_anchor_date, localCal);
      const masterMin = this.getAbsoluteMinute(anchor.master_anchor_date, masterCal);
      return masterMin - localMin;
    }

    if (anchor.master_absolute_minute !== undefined && anchor.local_absolute_minute !== undefined) {
      return anchor.master_absolute_minute - anchor.local_absolute_minute;
    }

    return 0;
  }

  /**
   * Конвертировать локальную дату в мировую абсолютную минуту (Master Timeline)
   */
  public static localDateToMasterMinute(
    date: CalendarDate['original_input'],
    localCal: CalendarData,
    masterCal?: CalendarData | null
  ): number {
    const localMin = this.getAbsoluteMinute(date, localCal);
    const offset = this.getAnchorOffset(localCal, masterCal);
    return localMin + offset;
  }

  /**
   * Конвертировать мировую абсолютную минуту в дату локального календаря
   */
  public static masterMinuteToLocalDate(
    masterMinute: number,
    localCal: CalendarData,
    masterCal?: CalendarData | null,
    era_index: number = 0
  ): CalendarDate['original_input'] {
    const offset = this.getAnchorOffset(localCal, masterCal);
    const localMin = masterMinute - offset;
    return this.getDateFromAbsolute(localMin, localCal, era_index);
  }

  /**
   * Сквозная конвертация даты между любыми двумя календарями через шкалу Мира
   */
  public static convertDateBetweenCalendars(
    date: CalendarDate['original_input'],
    fromCal: CalendarData,
    toCal: CalendarData,
    masterCal?: CalendarData | null,
    to_era_index: number = 0
  ): CalendarDate['original_input'] {
    if (fromCal === toCal || fromCal._id && fromCal._id === toCal._id) {
      return { ...date };
    }
    const masterMin = this.localDateToMasterMinute(date, fromCal, masterCal);
    return this.masterMinuteToLocalDate(masterMin, toCal, masterCal, to_era_index);
  }
}
