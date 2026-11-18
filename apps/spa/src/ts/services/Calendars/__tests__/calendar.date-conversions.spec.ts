import { describe, it, expect } from 'vitest';
import { CalendarDateConversions } from '../calendar.date-conversions';
import { CalendarFormat } from '../calendar.format';

describe('CalendarDateConversions branch coverage', () => {
  const baseCal = CalendarFormat.getDefaultCalendar();

  it('covers isLeapYear, getBaseDaysInYear, getDaysInYear, and getDaysInMonth fallbacks', () => {
    expect(CalendarDateConversions.isLeapYear(null as any, 2024)).toBe(false);
    expect(CalendarDateConversions.isLeapYear({ ...baseCal, правило_високосного_года: 'пользовательское', высокосные_правила: [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }] }, 2024)).toBe(true);
    expect(CalendarDateConversions.isLeapYear({ ...baseCal, правило_високосного_года: 'пользовательское', высокосные_правила: [], пользовательское_високосное_правило: { период: 5, месяц: 0, день_смещения: 1 } as any }, 2025)).toBe(true);
    expect(CalendarDateConversions.isLeapYear({ ...baseCal, правило_високосного_года: 'григорианское' }, 2024)).toBe(true);
    expect(CalendarDateConversions.isLeapYear({ ...baseCal, правило_високосного_года: 'unknown' as any }, 2024)).toBe(false);
    expect(CalendarDateConversions.isLeapYear(baseCal, NaN)).toBe(false);

    expect(CalendarDateConversions.getBaseDaysInYear(null as any)).toBe(365);
    expect(CalendarDateConversions.getBaseDaysInYear({ ...baseCal, месяцы: undefined as any })).toBe(365);
    expect(CalendarDateConversions.getBaseDaysInYear({ ...baseCal, месяцы: [{ название: 'M1', дней: 0 }] })).toBe(0);

    const extraCal = {
      ...baseCal,
      extra_days_config: { target_mode: 'in_extra_days', leap_days: 2, base_days: 5 },
    } as any;
    expect(CalendarDateConversions.getDaysInYear(extraCal, 2024)).toBe(372);
    const epagCal = { ...baseCal, extra_days_config: { target_mode: 'in_extra_days' }, epagomenal_config: { extra_days_leap: 3 } } as any;
    expect(CalendarDateConversions.getDaysInYear(epagCal, 2024)).toBe(368);
    expect(CalendarDateConversions.getDaysInMonth({ ...baseCal, месяцы: [{ название: 'M1', дней: 0 }] }, 2023, 0)).toBe(30);
  });

  it('covers getAbsoluteMinute, getDateFromAbsolute, and calendar conversions with sparse/wrapped inputs', () => {
    expect(CalendarDateConversions.getAbsoluteMinute({ year: 1, month: 0, day: 1 }, null as any)).toBe(0);
    expect(CalendarDateConversions.getDateFromAbsolute(100, null as any)).toEqual({
      year: 1, month: 0, day: 1, hour: 0, minute: 0, era_index: 0,
    });

    const sparseCal = {
      ...baseCal,
      правило_високосного_года: 'каждый 4 год',
      настройки_времени: { часов_в_сутках: 0, минут_в_часе: 0 },
      месяцы: undefined as any,
    } as any;
    const abs = CalendarDateConversions.getAbsoluteMinute({ original_input: {} } as any, sparseCal);
    expect(typeof abs).toBe('number');
    const back = CalendarDateConversions.getDateFromAbsolute(abs, sparseCal);
    expect(back.year).toBe(1);

    expect(CalendarDateConversions.getAnchorOffset(null, baseCal)).toBe(0);
    expect(CalendarDateConversions.masterMinuteToLocalDate(0, null, baseCal)).toEqual({
      year: 1, month: 0, day: 1, hour: 0, minute: 0, era_index: 0,
    });

    const convNull = CalendarDateConversions.convertDateBetweenCalendars({ original_input: {} } as any, null, baseCal, baseCal, 0);
    expect(convNull).toEqual({ year: 1, month: 0, day: 1, hour: 0, minute: 0, era_index: 0 });
    const convEmpty = CalendarDateConversions.convertDateBetweenCalendars({} as any, null, baseCal, baseCal, 2);
    expect(convEmpty.era_index).toBe(2);
  });

  it('covers formatAnchorOffsetDescription branches', () => {
    expect(CalendarDateConversions.formatAnchorOffsetDescription(null, baseCal)).toBe('Нет данных для синхронизации');
    expect(CalendarDateConversions.formatAnchorOffsetDescription(baseCal, baseCal)).toBe('Календарь ещё не привязан к Календарю Мира.');

    const localLinked = {
      ...baseCal,
      настройки_времени: undefined as any,
      sync_anchor: {
        linked_to_master: true,
        local_anchor_date: { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
        master_anchor_date: { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
      },
    } as any;
    expect(CalendarDateConversions.formatAnchorOffsetDescription(localLinked, baseCal)).toBe('Точка отсчета совпадает с началом Календаря Мира.');

    localLinked.sync_anchor.local_anchor_date = { era_index: 0, year: 1, month: 0, day: 3, hour: 5, minute: 0 };
    expect(CalendarDateConversions.formatAnchorOffsetDescription(localLinked, baseCal)).toContain('раньше Календаря Мира');

    localLinked.sync_anchor.local_anchor_date = { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 };
    localLinked.sync_anchor.master_anchor_date = { era_index: 0, year: 1, month: 0, day: 2, hour: 3, minute: 0 };
    expect(CalendarDateConversions.formatAnchorOffsetDescription(localLinked, baseCal)).toContain('позже Календаря Мира');
  });
});
