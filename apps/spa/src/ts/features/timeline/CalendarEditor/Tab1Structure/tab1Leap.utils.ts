/**
 * @file tab1Leap.utils.ts
 * @description Чистые функции расчета високосов, дрейфа орбиты и ленты структуры года
 * через нативное математическое ядро WebAssembly (@worldwiki/calendar-wasm).
 */

import {
  CalendarWasmBridge,
  defaultWasmEngine,
  type LeapHarmonic,
} from '@/services/Calendars/calendar.wasm-bridge';
import type { CalendarMonth } from '@/services/Calendars/calendar.types';

export interface YearTapeItem {
  type: 'month' | 'extra_days';
  name: string;
  days: number;
  isLeapTarget?: boolean;
  extraBadge?: string;
}

export interface UpcomingYearDto {
  year: number;
  isLeap: boolean;
  days: number;
}

export interface HarmonicRule {
  weight: number;
  period: number;
}

/**
 * Конвертирует правило пользовательского интерфейса в строгий типизированный набор гармоник Rust WASM.
 */
export function ruleToWasmHarmonics(
  ruleType: 'gregorian' | 'simple' | 'custom' | 'none',
  harmonics: HarmonicRule[] = [],
  simpleInterval = 4
): LeapHarmonic[] {
  if (ruleType === 'none') {
    return [];
  }
  if (ruleType === 'gregorian') {
    return [
      { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
      { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
      { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
    ];
  }
  if (ruleType === 'simple') {
    return [
      { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: simpleInterval || 4 },
    ];
  }
  if (ruleType === 'custom') {
    return harmonics
      .filter((h) => h.period > 0)
      .map((h) => ({
        weight: h.weight,
        multiplier_a: 1,
        shift_b: 0,
        divisor_c: h.period,
      }));
  }
  return [];
}

/**
 * Проверка високосности года через нативный движок Rust WASM (O(1)).
 */
export function isYearLeapCalculated(
  year: number,
  ruleType: 'gregorian' | 'simple' | 'custom' | 'none',
  harmonics: HarmonicRule[] = [],
  simpleInterval = 4
): boolean {
  if (ruleType === 'none') return false;
  const wasmHarmonics = ruleToWasmHarmonics(ruleType, harmonics, simpleInterval);
  return defaultWasmEngine.is_leap_year(BigInt(year), wasmHarmonics, 0);
}

/**
 * Построение ленты месяцев и праздников года для визуального инспектора.
 */
export function calculateYearTape(
  months: CalendarMonth[],
  extraDaysCount: number,
  extraDaysName: string,
  placement: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month',
  afterMonthIdx: number,
  targetMode: 'in_month' | 'in_extra_days',
  targetMonthIdx: number,
  leapOffset: number
): YearTapeItem[] {
  const tape: YearTapeItem[] = [];

  const extraItem: YearTapeItem = {
    type: 'extra_days',
    name: extraDaysName || 'Праздники',
    days: extraDaysCount,
    isLeapTarget: targetMode === 'in_extra_days',
    extraBadge: targetMode === 'in_extra_days' ? `+${leapOffset} в високос` : undefined,
  };

  if (extraDaysCount > 0 && placement === 'start_of_year') {
    tape.push(extraItem);
  }

  const midPoint = Math.floor(months.length / 2);

  months.forEach((m, idx) => {
    tape.push({
      type: 'month',
      name: m.название || `Месяц ${idx + 1}`,
      days: Number(m.дней) || 30,
      isLeapTarget: targetMode === 'in_month' && idx === targetMonthIdx,
      extraBadge: targetMode === 'in_month' && idx === targetMonthIdx ? `+${leapOffset}` : undefined,
    });

    if (extraDaysCount > 0 && placement === 'mid_year' && idx === midPoint - 1) {
      tape.push(extraItem);
    }

    if (extraDaysCount > 0 && placement === 'after_month' && idx === afterMonthIdx) {
      tape.push(extraItem);
    }
  });

  if (extraDaysCount > 0 && placement === 'end_of_year') {
    tape.push(extraItem);
  }

  return tape;
}

/**
 * Генерация инспектора ближайших 12 лет через WASM дни в году.
 */
export function calculateUpcomingYears(
  baseYear: number,
  baseYearDays: number,
  leapDaysOffset: number,
  ruleType: 'gregorian' | 'simple' | 'custom' | 'none',
  harmonics: HarmonicRule[] = [],
  simpleInterval = 4
): UpcomingYearDto[] {
  const list: UpcomingYearDto[] = [];
  const wasmHarmonics = ruleToWasmHarmonics(ruleType, harmonics, simpleInterval);

  for (let i = 0; i < 12; i++) {
    const y = baseYear + i;
    const isLeap = defaultWasmEngine.is_leap_year(BigInt(y), wasmHarmonics, 0);
    const days = Number(
      defaultWasmEngine.days_in_year(
        BigInt(y),
        BigInt(baseYearDays),
        wasmHarmonics,
        BigInt(leapDaysOffset)
      )
    );
    list.push({
      year: y,
      isLeap,
      days,
    });
  }
  return list;
}

/**
 * Расчет векового дрейфа календаря относительно истинного тропического года орбиты
 * строго через нативный алгоритм Rust WASM drift_per_century.
 */
export function calculateCenturyDrift(
  baseDays: number,
  extraDays: number,
  orbitDays: number,
  ruleType: 'gregorian' | 'simple' | 'custom' | 'none',
  harmonics: HarmonicRule[] = [],
  _leapOffset = 1
): { driftCentury: number; label: string; isOk: boolean } {
  const nominalYear = baseDays + extraDays;
  const wasmHarmonics = ruleToWasmHarmonics(ruleType, harmonics);

  // Вызов нативного ядра WASM (f64 drift per 100 years)
  const driftCentury = CalendarWasmBridge.calculateDriftPerCentury(
    nominalYear,
    wasmHarmonics,
    orbitDays
  );

  const sign = driftCentury >= 0 ? '+' : '';
  const label = `${sign}${driftCentury.toFixed(3)} сут/век`;
  const isOk = Math.abs(driftCentury) < 0.1;

  return { driftCentury, label, isOk };
}

export const STANDARD_LEAP_SUGGESTIONS = [
  {
    key: 'simple',
    ratio: '1 дн. / 4 года',
    desc: 'Простое правило: каждые 4 года +1 день (Юлианский стиль)',
    drift: '+0.780 сут/век',
    isOk: false,
  },
  {
    key: 'persian',
    ratio: '8 дн. / 33 года',
    desc: 'Персидский цикл (Омар Хайям): 8 високосов за 33 года',
    drift: '+0.020 сут/век',
    isOk: true,
  },
  {
    key: 'gregorian',
    ratio: '97 дн. / 400 лет',
    desc: 'Григорианский стандарт: каждые 4 года (+1), кроме 100 (-1), плюс 400 (+1)',
    drift: '-0.030 сут/век',
    isOk: true,
  },
  {
    key: 'medler',
    ratio: '31 дн. / 128 лет',
    desc: 'Цикл Медлера: каждые 4 года (+1), кроме 128 (-1). 1 день за 100 000 лет!',
    drift: '+0.001 сут/век',
    isOk: true,
  },
];

