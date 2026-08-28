import { describe, it, expect } from 'vitest';
import { CalendarMath } from '../calendar.math';
import type { CalendarData } from '../calendar.types';

describe('CalendarMath', () => {
  const defaultCal: CalendarData = CalendarMath.getDefaultCalendar();

  describe('Leap Year calculations', () => {
    it('calculates Gregorian leap years correctly', () => {
      expect(CalendarMath.isLeapYear(defaultCal, 2024)).toBe(true);
      expect(CalendarMath.isLeapYear(defaultCal, 2023)).toBe(false);
      expect(CalendarMath.isLeapYear(defaultCal, 2000)).toBe(true);
      expect(CalendarMath.isLeapYear(defaultCal, 1900)).toBe(false);
    });

    it('calculates "каждый 4 год" leap rule', () => {
      const cal = { ...defaultCal, правило_високосного_года: 'каждый 4 год' };
      expect(CalendarMath.isLeapYear(cal, 1900)).toBe(true);
      expect(CalendarMath.isLeapYear(cal, 2024)).toBe(true);
      expect(CalendarMath.isLeapYear(cal, 2025)).toBe(false);
    });

    it('returns false for unrecognized rule', () => {
      const cal = { ...defaultCal, правило_високосного_года: 'none' as any };
      expect(CalendarMath.isLeapYear(cal, 2024)).toBe(false);
    });
  });

  describe('Days in Year & Month', () => {
    it('returns 365 days for non-leap year and 366 for leap year in Gregorian', () => {
      const cal: CalendarData = {
        ...defaultCal,
        пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 },
      };
      expect(CalendarMath.getDaysInYear(cal, 2023)).toBe(365);
      expect(CalendarMath.getDaysInYear(cal, 2024)).toBe(366);
    });

    it('gets days in month accounting for leap year', () => {
      const cal: CalendarData = {
        ...defaultCal,
        пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 },
      };
      // February non-leap
      expect(CalendarMath.getDaysInMonth(cal, 2023, 1)).toBe(28);
      // February leap
      expect(CalendarMath.getDaysInMonth(cal, 2024, 1)).toBe(29);
      // January (index 0)
      expect(CalendarMath.getDaysInMonth(cal, 2024, 0)).toBe(31);
    });

    it('returns fallback 30 for invalid month index or missing calendar', () => {
      expect(CalendarMath.getDaysInMonth(null as any, 2024, 0)).toBe(30);
      expect(CalendarMath.getDaysInMonth(defaultCal, 2024, 99)).toBe(30);
    });
  });

  describe('Absolute Minute conversions (Two-way)', () => {
    it('converts date to absolute minute and back accurately', () => {
      const cal: CalendarData = {
        ...defaultCal,
        пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 },
      };
      const input = {
        era_index: 0,
        year: 2024,
        month: 5,
        day: 15,
        hour: 14,
        minute: 30,
      };

      const absMin = CalendarMath.getAbsoluteMinute(input, cal);
      expect(absMin).toBeGreaterThan(0);

      const convertedDate = CalendarMath.getDateFromAbsolute(absMin, cal, 0);
      expect(convertedDate.year).toBe(2024);
      expect(convertedDate.month).toBe(5);
      expect(convertedDate.day).toBe(15);
      expect(convertedDate.hour).toBe(14);
      expect(convertedDate.minute).toBe(30);
    });

    it('handles year 1 day 1 minute 0 as epoch baseline', () => {
      const cal = { ...defaultCal, пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 } };
      const input = { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 };
      const absMin = CalendarMath.getAbsoluteMinute(input, cal);
      expect(absMin).toBe(0);

      const res = CalendarMath.getDateFromAbsolute(0, cal, 0);
      expect(res).toEqual({ era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 });
    });
  });

  describe('Moon Phase calculations', () => {
    it('calculates moon phases correctly', () => {
      const moons = [{
        name: 'Luna',
        period_days: 28,
        initial_phase: 0,
        phase_names: { new: 'Новолуние', waxing: 'Растущая', full: 'Полнолуние', waning: 'Убывающая' }
      }];

      const minutesInDay = 24 * 60;
      // New moon at minute 0
      const res0 = CalendarMath.calculateMoonPhases(0, moons, defaultCal);
      expect(res0[0].name).toBe('Новолуние');
      expect(res0[0].emoji).toBe('🌑');

      // Full moon at 14 days (half cycle = 0.5)
      const resFull = CalendarMath.calculateMoonPhases(14 * minutesInDay, moons, defaultCal);
      expect(resFull[0].name).toBe('Полнолуние');
      expect(resFull[0].emoji).toBe('🌕');
    });
  });

  describe('Daylight calculations', () => {
    it('returns null when seasonal daylight is disabled', () => {
      expect(CalendarMath.calculateDaylight(1000, defaultCal)).toBeNull();
    });

    it('calculates daylight when seasonal daylight is enabled', () => {
      const cal: CalendarData = {
        ...defaultCal,
        настройки_времени: {
          ...defaultCal.настройки_времени!,
          учитывать_сезонную_длительность_дня: true,
        },
        day_length_anchor: {
          summer_solstice_hours: 16,
          winter_solstice_hours: 8,
        }
      };

      const result = CalendarMath.calculateDaylight(100000, cal);
      expect(result).not.toBeNull();
      expect(result?.zenith).toBe('12:00');
      expect(result?.sunrise).toBeDefined();
      expect(result?.sunset).toBeDefined();
      expect(result?.duration_hours).toBeGreaterThan(0);
    });
  });

  describe('Duration string parsing', () => {
    it('parses composite duration strings', () => {
      const str = '1 год 2 месяца 5 дней 3 часа';
      const mins = CalendarMath.parseDurationString(str, defaultCal);
      expect(mins).toBeGreaterThan(0);

      const oneYearMins = 365 * 24 * 60;
      expect(mins).toBeGreaterThan(oneYearMins);
    });
  });

  describe('Holidays and Seasons', () => {
    it('detects holiday in range', () => {
      const cal: CalendarData = {
        ...defaultCal,
        праздники: [{
          название: 'Новый год',
          дата_начала: { месяц: 0, день: 1 },
          дата_конца: { месяц: 0, день: 3 },
          описание: 'Праздник'
        }]
      };

      expect(CalendarMath.isHoliday(cal, 2024, 0, 2)).toBe(true);
      expect(CalendarMath.isHoliday(cal, 2024, 0, 5)).toBe(false);
      expect(CalendarMath.isHoliday(cal, 2024, 1, 1)).toBe(false);
    });

    it('returns season for month index', () => {
      const cal: CalendarData = {
        ...defaultCal,
        сезоны: [
          { название: 'Зима', месяцы: [11, 0, 1] },
          { название: 'Лето', месяцы: [5, 6, 7] },
        ]
      };

      expect(CalendarMath.getSeasonForDate(cal, 2024, 0)).toBe('Зима');
      expect(CalendarMath.getSeasonForDate(cal, 2024, 6)).toBe('Лето');
      expect(CalendarMath.getSeasonForDate(cal, 2024, 3)).toBe('Вне сезона');
    });
  });

  describe('Date formatting & Helpers', () => {
    it('formats date into human readable string', () => {
      const formatted = CalendarMath.formatDate(defaultCal, {
        original_input: {
          era_index: 0,
          year: 2024,
          month: 0,
          day: 15,
          hour: 10,
          minute: 30,
        }
      } as any);

      expect(formatted).toBe('2024 год, Январь 15 (Наша эра) в 10:30');
    });

    it('merges calendar data correctly including nested objects', () => {
      const custom = CalendarMath.mergeCalendarData(defaultCal, {
        название: 'Кастомный календарь',
        дней_в_неделе: 8,
        настройки_времени: {
          часов_в_сутках: 30,
        } as any,
      });

      expect(custom.название).toBe('Кастомный календарь');
      expect(custom.дней_в_неделе).toBe(8);
      expect(custom.настройки_времени?.часов_в_сутках).toBe(30);
      expect(custom.настройки_времени?.минут_в_часе).toBe(60);
      expect(custom.месяцы.length).toBe(12);
    });

    it('handles getMonthName and getDayName with valid and out of bounds indices', () => {
      expect(CalendarMath.getMonthName(defaultCal, 0)).toBe('Январь');
      expect(CalendarMath.getMonthName(defaultCal, 99)).toBe('Неизвестный месяц');

      expect(CalendarMath.getDayName(defaultCal, 0)).toBe('Понедельник');
      expect(CalendarMath.getDayName(defaultCal, 99)).toBe('День');
    });

    it('handles formatDate fallbacks for null inputs, undefined parts, missing era and missing time', () => {
      expect(CalendarMath.formatDate(defaultCal, null as any)).toBe('');
      expect(CalendarMath.formatDate(defaultCal, {} as any)).toBe('');
      expect(CalendarMath.formatDate(defaultCal, { original_input: {} } as any)).toBe('');

      // Missing era and missing time
      const bareCal = {
        ...defaultCal,
        эпохи: [],
        месяцы: [{} as any],
      };
      const formatted = CalendarMath.formatDate(bareCal, {
        original_input: {
          era_index: 0,
          year: 500,
          month: 0,
          day: 10,
        },
      } as any);
      expect(formatted).toBe('500 год, Месяц 1 10');
    });

    it('handles reverse countdown eras and negative years in absolute minute conversions', () => {
      const bceCal: CalendarData = {
        ...defaultCal,
        эпохи: [{ название: 'До н.э.', год_начала: 1, год_конца: 1000, обратный_отсчет: true }],
      };

      const input = { era_index: 0, year: 5, month: 2, day: 10, hour: 8, minute: 15 };
      const abs = CalendarMath.getAbsoluteMinute(input, bceCal);
      expect(abs).toBeLessThan(0);

      const converted = CalendarMath.getDateFromAbsolute(abs, bceCal, 0);
      expect(converted.era_index).toBe(0);
      expect(converted.year).toBe(6);
    });

    it('handles multi-month spanning holidays, middle months, and empty calendar holidays/seasons', () => {
      const calMulti: CalendarData = {
        ...defaultCal,
        праздники: [{
          название: 'Фестиваль трех месяцев',
          дата_начала: { месяц: 0, день: 20 },
          дата_конца: { месяц: 2, день: 10 },
          описание: 'Фестиваль',
        }],
      };

      // Start month before start day
      expect(CalendarMath.isHoliday(calMulti, 2024, 0, 15)).toBe(false);
      // Start month on or after start day
      expect(CalendarMath.isHoliday(calMulti, 2024, 0, 25)).toBe(true);
      // Middle month (monthIdx 1: strictly between 0 and 2)
      expect(CalendarMath.isHoliday(calMulti, 2024, 1, 15)).toBe(true);
      // End month before or on end day
      expect(CalendarMath.isHoliday(calMulti, 2024, 2, 5)).toBe(true);
      // End month after end day
      expect(CalendarMath.isHoliday(calMulti, 2024, 2, 15)).toBe(false);

      // Null calendar / empty holidays & seasons
      expect(CalendarMath.isHoliday(null as any, 2024, 0, 1)).toBe(false);
      expect(CalendarMath.getSeasonForDate(null as any, 2024, 0)).toBe('Вне сезона');
      expect(CalendarMath.getSeasonForDate({ ...defaultCal, сезоны: [] }, 2024, 0)).toBe('Вне сезона');
    });

    it('calculates moon phases for negative phases and missing phase_names', () => {
      const moons = [{
        name: 'DarkMoon',
        period_days: 10,
        initial_phase: -0.5,
        // no phase_names
      }];

      const res = CalendarMath.calculateMoonPhases(-1000, moons as any, defaultCal);
      expect(res.length).toBe(1);
      expect(res[0].name).toBeDefined();

      // Waxing phase (0.2) and waning phase (0.7)
      const testMoons = [
        { name: 'WaxMoon', period_days: 10, initial_phase: 0.2 },
        { name: 'WaneMoon', period_days: 10, initial_phase: 0.7 },
      ];
      const resPhases = CalendarMath.calculateMoonPhases(0, testMoons as any, defaultCal);
      expect(resPhases[0].emoji).toBe('🌓');
      expect(resPhases[0].name).toBe('Растущая');
      expect(resPhases[1].emoji).toBe('🌗');
      expect(resPhases[1].name).toBe('Убывающая');
    });
  });

  describe('Load / Performance Test (10,000 date conversions)', () => {
    it('converts 10,000 dates in under 200ms', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        const abs = i * 1440; // 1 day interval
        CalendarMath.getDateFromAbsolute(abs, defaultCal, 0);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });

  describe('SyncAnchor & Cross-Calendar Synchronization', () => {
    const masterCal: CalendarData = {
      ...defaultCal,
      is_master: true,
      пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 },
    };

    const tribalCal: CalendarData = {
      название: 'Племя Огня',
      calendar_type: 'local',
      is_master: false,
      дней_в_неделе: 5,
      названия_дней_недели: ['Д1', 'Д2', 'Д3', 'Д4', 'Д5'],
      первый_месяц_года: 0,
      месяцы: Array.from({ length: 10 }, (_, i) => ({
        название: `Луна ${i + 1}`,
        дней: 30,
      })),
      эпохи: [{ название: 'Эпоха Пепла', год_начала: 1, год_конца: 500 }],
      правило_високосного_года: 'нет',
      sync_anchor: {
        master_calendar_id: 'master_1',
        linked_to_master: true,
        local_anchor_date: {
          era_index: 0,
          year: 1,
          month: 0,
          day: 1,
          hour: 0,
          minute: 0,
        },
        master_anchor_date: {
          era_index: 0,
          year: 1200,
          month: 5,
          day: 15,
          hour: 0,
          minute: 0,
        },
      },
    };

    it('calculates anchor offset correctly', () => {
      const offset = CalendarMath.getAnchorOffset(tribalCal, masterCal);
      expect(offset).toBeGreaterThan(0);

      // Local 1.1.1 00:00 -> converts to Master 1200-05-15 00:00
      const masterMin = CalendarMath.localDateToMasterMinute(
        { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
        tribalCal,
        masterCal
      );
      const masterDate = CalendarMath.getDateFromAbsolute(masterMin, masterCal, 0);
      expect(masterDate.year).toBe(1200);
      expect(masterDate.month).toBe(5);
      expect(masterDate.day).toBe(15);
    });

    it('converts master minute back to local date accurately', () => {
      const masterMin = CalendarMath.localDateToMasterMinute(
        { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
        tribalCal,
        masterCal
      );
      const localDate = CalendarMath.masterMinuteToLocalDate(masterMin, tribalCal, masterCal, 0);
      expect(localDate.year).toBe(1);
      expect(localDate.month).toBe(0);
      expect(localDate.day).toBe(1);
    });

    it('cross-converts dates between two calendars via convertDateBetweenCalendars', () => {
      // 10 days later in tribal calendar (day 11 of month 0)
      const input = { era_index: 0, year: 1, month: 0, day: 11, hour: 10, minute: 30 };
      const resInMaster = CalendarMath.convertDateBetweenCalendars(
        input,
        tribalCal,
        masterCal,
        masterCal,
        0
      );
      expect(resInMaster.year).toBe(1200);
      expect(resInMaster.month).toBe(5);
      expect(resInMaster.day).toBe(25);
      expect(resInMaster.hour).toBe(10);
      expect(resInMaster.minute).toBe(30);

      // Roundtrip back to tribal
      const roundtrip = CalendarMath.convertDateBetweenCalendars(
        resInMaster,
        masterCal,
        tribalCal,
        masterCal,
        0
      );
      expect(roundtrip.year).toBe(1);
      expect(roundtrip.month).toBe(0);
      expect(roundtrip.day).toBe(11);
      expect(roundtrip.hour).toBe(10);
      expect(roundtrip.minute).toBe(30);
    });
  });

  describe('Literary Date Explainer & Humanized Offset', () => {
    it('formats anchor offset description in human words', () => {
      const master = CalendarMath.getDefaultCalendar();
      master.is_master = true;

      const local = CalendarMath.getDefaultCalendar();
      local.is_master = false;
      local.sync_anchor = {
        linked_to_master: true,
        local_anchor_date: { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
        master_anchor_date: { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
      };

      expect(CalendarMath.formatAnchorOffsetDescription(local, master)).toBe('Точка отсчета совпадает с началом Календаря Мира.');

      // Local is 40 year, master is 1 year -> local began 39 years EARLIER
      local.sync_anchor.local_anchor_date!.year = 40;
      local.sync_anchor.master_anchor_date!.year = 1;
      const descEarlier = CalendarMath.formatAnchorOffsetDescription(local, master);
      expect(descEarlier).toContain('раньше Календаря Мира');
      expect(descEarlier).toContain('39 г.');

      // Unlinked
      local.sync_anchor.linked_to_master = false;
      expect(CalendarMath.formatAnchorOffsetDescription(local, master)).toContain('Календарь ещё не привязан');
    });

    it('formats daylight without scientific jargon', () => {
      const daylight = {
        sunrise: '04:18',
        sunset: '22:00',
        zenith: '12:00',
        duration_hours: 17.7,
      };
      const formatted = CalendarMath.formatDaylightLiterary(daylight);
      expect(formatted).not.toBeNull();
      expect(formatted!.duration).toBe('Световой день: 17 ч 42 мин');
      expect(formatted!.sunrise).toBe('Восход: 04:18');
      expect(formatted!.sunset).toBe('Закат: 22:00');
    });

    it('generates rich lore explanation and snippet for writer', () => {
      const master = CalendarMath.getDefaultCalendar();
      master.is_master = true;
      master.название = 'Календарь Мира';

      const tribal = CalendarMath.getDefaultCalendar();
      tribal.is_master = false;
      tribal.название = 'Племя Тумба-Юмб';
      tribal.sync_anchor = {
        linked_to_master: true,
        local_anchor_date: { era_index: 0, year: 40, month: 0, day: 1, hour: 0, minute: 0 },
        master_anchor_date: { era_index: 0, year: 1200, month: 0, day: 1, hour: 0, minute: 0 },
      };

      const date = { era_index: 0, year: 40, month: 0, day: 1, hour: 12, minute: 0 };
      const explanation = CalendarMath.explainDate(date, tribal, [master, tribal], master);

      expect(explanation.localDateFormatted).toContain('40 год');
      expect(explanation.masterDateFormatted).toContain('1200 год');
      expect(explanation.snippet).toContain('40 год');
      expect(explanation.snippet).toContain('по Календарю Мира');
    });
  });
});
