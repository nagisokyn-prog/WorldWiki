import { describe, it, expect } from 'vitest';
import {
  calculateNewStyleFirstDay,
  calculateVisualTape,
  calculateDualDating,
  formatSliderTime,
  getSpringAlertData,
  getAutumnAlertData,
} from './tab5ReformsDst.utils';

describe('tab5ReformsDst.utils', () => {
  it('calculates new style first day within month, across month, and across year', () => {
    expect(calculateNewStyleFirstDay({ oldDay: 4, oldMonth: 10, oldYear: 1582, droppedDays: 10 })).toBe('15 Октября 1582');
    expect(calculateNewStyleFirstDay({ oldDay: 25, oldMonth: 1, oldYear: 1918, droppedDays: 10 })).toBe('5 Февраля 1918');
    expect(calculateNewStyleFirstDay({ oldDay: 25, oldMonth: 12, oldYear: 1999, droppedDays: 10 })).toBe('5 Января 2000');
  });

  it('calculates visual tape for gap, transitional, and reset modes', () => {
    const gap = { oldDay: 4, oldMonth: 10, oldYear: 1582, droppedDays: 10 };
    const trans = { transitionalYear: -46, addedDays: 90 };
    const reset = { resetDay: 22, resetMonth: 9, resetYearOld: 1792, resetToYear: 1 };

    expect(calculateVisualTape('gap', gap, trans, reset, '15 Октября 1582').middle).toContain('10 дней');
    expect(calculateVisualTape('transitional', gap, trans, reset, '').middle).toContain('90');
    expect(calculateVisualTape('reset', gap, trans, reset, '').end).toContain('Год 1');
  });

  it('calculates dual dating across historical centuries', () => {
    expect(calculateDualDating({ day: 1, month: 1, year: 1500 }).nsDateStr).toBe('1 Января 1500 г.');
    expect(calculateDualDating({ day: 1, month: 1, year: 1650 }).nsDateStr).toContain('+10 дн');
    expect(calculateDualDating({ day: 1, month: 1, year: 1750 }).nsDateStr).toContain('+11 дн');
    expect(calculateDualDating({ day: 1, month: 1, year: 1850 }).nsDateStr).toContain('+12 дн');
    expect(calculateDualDating({ day: 1, month: 1, year: 1950 }).nsDateStr).toContain('+13 дн');
  });

  it('formats slider time and computes spring/autumn DST alerts', () => {
    expect(formatSliderTime(125)).toBe('02:05');

    expect(getSpringAlertData(90).title).toContain('ЗИМНЕЕ');
    expect(getSpringAlertData(150).title).toContain('GAP');
    expect(getSpringAlertData(180).title).toContain('ЛЕТНЕЕ');

    expect(getAutumnAlertData(90, 0, '01:30').desc).toContain('До перевода');
    expect(getAutumnAlertData(150, 0, '02:30').desc).toContain('fold: 0');
    expect(getAutumnAlertData(150, 1, '02:30').desc).toContain('fold: 1');
    expect(getAutumnAlertData(180, 0, '03:00').desc).toContain('переведены назад');
  });
});
