/**
 * @file calendar.wasm-fallback.ts
 * @description Чистый JS-фоллбэк для Proxy WasmCalendarEngine на время асинхронной инициализации WASM.
 */

import type { MonthGridParams } from '@worldwiki/calendar-wasm';

export function createWasmFallback(prop: string | symbol): unknown {
  if (prop === 'is_leap_year') {
    return (year: bigint | number, rules: Array<{ divisor_c?: number; weight?: number }>, _baseOffset: number) => {
      const y = Number(year);
      if (Array.isArray(rules) && rules.length > 0) {
        let leap = false;
        for (const r of rules) {
          const div = r.divisor_c || 4;
          if (div > 0 && y % div === 0) {
            leap = (r.weight || 1) > 0;
          }
        }
        return leap;
      }
      return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    };
  }

  if (prop === 'audit_calendar_culture') {
    return () => ({ is_valid: true, issues: [], score: 100, drift_per_century: 0, recommendations: [] });
  }

  if (prop === 'generate_year_preview') {
    return () => ({ year: 1, months: Array.from({ length: 12 }, (_, i) => ({ month_index: i, days_count: 30, days: [] })) });
  }

  if (prop === 'days_up_to_year') {
    return (year: bigint | number, baseDays: bigint | number) => {
      const y = Number(year);
      const bd = Math.max(1, Number(baseDays));
      return BigInt(Math.max(0, y - 1) * bd);
    };
  }

  if (prop === 'year_from_days') {
    return (days: bigint | number, baseDays: bigint | number) => {
      const d = Number(days);
      const bd = Math.max(1, Number(baseDays));
      return BigInt(Math.floor(d / bd));
    };
  }

  if (prop === 'intervals_overlap') {
    return (s1: bigint | number, e1: bigint | number, s2: bigint | number, e2: bigint | number) => {
      return Number(s1) < Number(e2) && Number(s2) < Number(e1);
    };
  }

  if (prop === 'check_bilocation') {
    return (s1: unknown, e1: unknown, loc1: unknown, s2: unknown, e2: unknown, loc2: unknown) => {
      return loc1 !== loc2 && Number(s1) < Number(e2) && Number(s2) < Number(e1);
    };
  }

  if (prop === 'check_death_violation') {
    return (_start: unknown, end: unknown, death: unknown) => {
      return Number(end) > Number(death);
    };
  }

  if (prop === 'get_month_grid_bundle') {
    return (params: MonthGridParams) => {
      const isLeap = (params.year % 4 === 0 && params.year % 100 !== 0) || (params.year % 400 === 0);
      const daysCount = params.month === 1 ? (isLeap ? 29 : 28) : (params.config?.regular_months?.[params.month] ?? 30);
      const days = Array.from({ length: daysCount }, (_, i) => {
        const dayNum = i + 1;
        const matchingHolidays = (params.holidays || []).filter(h => h.start_month === params.month && dayNum >= h.start_day && dayNum <= h.end_day);
        return {
          day: dayNum,
          is_holiday: matchingHolidays.length > 0,
          holiday_names: matchingHolidays.map(h => h.name),
          weekday: (dayNum - 1) % 7,
        };
      });
      return {
        days_count: daysCount,
        is_leap_year: isLeap,
        days,
      };
    };
  }

  return () => 0;
}
