/**
 * @file useCalendarEngine.ts
 * @description Единый реактивный фасад математического ядра календаря для Vue 3.
 * Реализует O(1) преобразования t_abs <-> LocalMoment, DialHierarchy, гармоники високосов и дрейф.
 */

import { computed } from 'vue';
import type { CalendarData, CalendarDate, DialHierarchy, LocalMoment, LeapHarmonic } from './calendar.types';
import { CalendarCycles } from './calendar.cycles';
import { CalendarLunar } from './calendar.lunar';
import { CalendarMath } from './calendar.math';

export function useCalendarEngine() {
  /**
   * Преобразует абсолютное галактическое время t_abs в локальный момент планеты
   */
  const tAbsToLocalMoment = (
    tAbs: bigint | number,
    planetId: string,
    ticksPerDay: number,
    dayStartOffset: number = 0
  ): LocalMoment => {
    const t = BigInt(tAbs);
    const tPerDay = BigInt(ticksPerDay > 0 ? ticksPerDay : 86400);
    const offset = BigInt(dayStartOffset);

    const shifted = t - offset;
    let worldDay = shifted / tPerDay;
    let dayTick = shifted % tPerDay;

    if (dayTick < 0n) {
      dayTick += tPerDay;
      worldDay -= 1n;
    }

    return {
      planet_id: planetId,
      world_day: Number(worldDay),
      day_tick: Number(dayTick),
    };
  };

  /**
   * Преобразует локальный момент планеты обратно в галактическое t_abs
   */
  const localMomentToTAbs = (
    moment: LocalMoment,
    ticksPerDay: number,
    dayStartOffset: number = 0
  ): bigint => {
    const tPerDay = BigInt(ticksPerDay > 0 ? ticksPerDay : 86400);
    const offset = BigInt(dayStartOffset);
    const raw = BigInt(moment.world_day) * tPerDay + BigInt(moment.day_tick);
    return raw + offset;
  };

  /**
   * Преобразование единиц циферблата в тики суток с округлением вверх (ceil)
   */
  const unitsToDayTick = (
    unitValues: number[],
    hierarchy: DialHierarchy,
    ticksPerDay: number
  ): number => {
    if (!hierarchy.units || hierarchy.units.length === 0 || ticksPerDay <= 0) {
      return 0;
    }

    let totalD = 1;
    for (const u of hierarchy.units) {
      totalD *= Math.max(1, u.subdivisions);
    }

    let linearUnit = 0;
    let runningProduct = totalD;
    for (let i = 0; i < hierarchy.units.length; i++) {
      const sub = Math.max(1, hierarchy.units[i].subdivisions);
      runningProduct = Math.floor(runningProduct / sub);
      const val = unitValues[i] || 0;
      linearUnit += val * runningProduct;
    }

    // Ceil квантование: (linearUnit * ticksPerDay + totalD - 1) / totalD
    const tick = Math.floor((linearUnit * ticksPerDay + totalD - 1) / totalD);
    return Math.min(tick, ticksPerDay - 1);
  };

  /**
   * Преобразование тика суток в единицы циферблата с округлением вниз (floor)
   */
  const dayTickToUnits = (
    dayTick: number,
    hierarchy: DialHierarchy,
    ticksPerDay: number
  ): number[] => {
    if (!hierarchy.units || hierarchy.units.length === 0 || ticksPerDay <= 0) {
      return [];
    }

    let totalD = 1;
    for (const u of hierarchy.units) {
      totalD *= Math.max(1, u.subdivisions);
    }

    let linearUnit = Math.floor((dayTick * totalD) / ticksPerDay);
    if (linearUnit >= totalD) {
      linearUnit = totalD - 1;
    }

    const result: number[] = [];
    let rem = linearUnit;
    let runningProduct = totalD;
    for (let i = 0; i < hierarchy.units.length; i++) {
      const sub = Math.max(1, hierarchy.units[i].subdivisions);
      runningProduct = Math.floor(runningProduct / sub);
      const val = Math.floor(rem / runningProduct);
      result.push(val);
      rem %= runningProduct;
    }

    return result;
  };

  /**
   * Расчет векового дрейфа (в сутках за 100 лет)
   */
  const calculateDriftPerCentury = (
    baseDays: number,
    harmonics: LeapHarmonic[],
    targetYearLengthDays: number
  ): number => {
    let sumWeight = 0;
    for (const h of harmonics) {
      if (h.divisor_c > 0) {
        sumWeight += (h.weight * h.multiplier_a) / h.divisor_c;
      }
    }
    const calYearLength = baseDays + sumWeight;
    return (calYearLength - targetYearLengthDays) * 100.0;
  };

  /**
   * Проверка гармоник на допустимость разности шага високоса {0, 1}
   */
  const validateHarmonics = (
    harmonics: LeapHarmonic[],
    daysOffset: number = 0
  ): { is_valid: boolean; min_diff: number; max_diff: number; period_lcm: number } => {
    if (harmonics.length === 0) {
      return { is_valid: true, min_diff: 0, max_diff: 0, period_lcm: 1 };
    }

    const gcd = (a: number, b: number): number => {
      let x = Math.abs(a);
      let y = Math.abs(b);
      while (y !== 0) {
        const t = y;
        y = x % y;
        x = t;
      }
      return x;
    };

    const lcm = (a: number, b: number): number => {
      if (a === 0 || b === 0) return 0;
      return Math.abs(Math.floor((a * b) / gcd(a, b)));
    };

    let p = 1;
    for (const h of harmonics) {
      p = lcm(p, h.divisor_c > 0 ? h.divisor_c : 1);
    }
    const checkPeriod = Math.min(p, 10000);

    let minDiff = 1000;
    let maxDiff = -1000;

    for (let y = 0; y < checkPeriod; y++) {
      const fCurr = CalendarCycles.leapsCount(y, harmonics, daysOffset);
      const fPrev = CalendarCycles.leapsCount(y - 1, harmonics, daysOffset);
      const diff = fCurr - fPrev;
      if (diff < minDiff) minDiff = diff;
      if (diff > maxDiff) maxDiff = diff;
    }

    const isValid = minDiff >= 0 && maxDiff <= 1;
    return {
      is_valid: isValid,
      min_diff: minDiff,
      max_diff: maxDiff,
      period_lcm: p,
    };
  };

  return {
    tAbsToLocalMoment,
    localMomentToTAbs,
    unitsToDayTick,
    dayTickToUnits,
    calculateDriftPerCentury,
    validateHarmonics,
    // Экспорт базовых методов
    isLeapYear: CalendarCycles.isLeapYear.bind(CalendarCycles),
    getDaysInYear: CalendarCycles.getDaysInYear.bind(CalendarCycles),
    getDaysUpToYear: CalendarCycles.getDaysUpToYear.bind(CalendarCycles),
    getAbsoluteMinute: CalendarMath.getAbsoluteMinute.bind(CalendarMath),
    getDateFromAbsolute: CalendarMath.getDateFromAbsolute.bind(CalendarMath),
    calculateMoonPhases: CalendarLunar.calculateMoonPhases.bind(CalendarLunar),
    calculateSunForRegion: CalendarLunar.calculateSunForRegion.bind(CalendarLunar),
  };
}
