/**
 * @file tab5ReformsDst.utils.ts
 * @description Чистые функции расчета дат реформ, двойной датировки и симулятора DST.
 */

import type {
  DualDatingInput,
  DualDatingResult,
  GapReformParams,
  ResetReformParams,
  TransitionalReformParams,
} from './Tab5ReformsDst.model';

export const DEFAULT_MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const DEFAULT_MONTH_NAMES_GENITIVE = [
  'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
  'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря',
];

export const DEFAULT_WEEKDAY_NAMES = [
  'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье',
];

export function calculateNewStyleFirstDay(gap: GapReformParams): string {
  const monthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let curDay = gap.oldDay + gap.droppedDays + 1;
  let curMonth = gap.oldMonth;
  let curYear = gap.oldYear;

  const maxDays = monthDays[curMonth] || 30;
  if (curDay > maxDays) {
    curDay -= maxDays;
    curMonth += 1;
    if (curMonth > 12) {
      curMonth = 1;
      curYear += 1;
    }
  }
  const mName = DEFAULT_MONTH_NAMES_GENITIVE[curMonth - 1] || 'Октября';
  return `${curDay} ${mName} ${curYear}`;
}

export function calculateVisualTape(
  mode: 'gap' | 'transitional' | 'reset',
  gap: GapReformParams,
  trans: TransitionalReformParams,
  reset: ResetReformParams,
  newStyleDateStr: string
): { start: string; middle: string; end: string } {
  if (mode === 'gap') {
    const oldM = DEFAULT_MONTH_NAMES_GENITIVE[gap.oldMonth - 1] || 'Октября';
    return {
      start: `📜 Четверг, ${gap.oldDay} ${oldM} ${gap.oldYear} (Старый стиль O.S.)`,
      middle: `🚫 ${gap.droppedDays} дней стёрто из истории (дни недели не прерывались!)`,
      end: `📜 Пятница, ${newStyleDateStr} (Новый стиль N.S.)`,
    };
  }
  if (mode === 'transitional') {
    return {
      start: 'Древний календарный цикл',
      middle: `⏳ Переходный год ${trans.transitionalYear}: +${trans.addedDays} интеркалярных дней (annus confusionis)`,
      end: 'Стабилизированный календарь нового счета',
    };
  }
  const resetM = DEFAULT_MONTH_NAMES_GENITIVE[reset.resetMonth - 1] || 'Сентября';
  return {
    start: `Хроники Старой Монархии (до ${reset.resetDay} ${resetM} ${reset.resetYearOld})`,
    middle: 'Смена эпохи',
    end: `🌟 Сброс в Год ${reset.resetToYear} Новой Эры (EpochReset: 1 Вандемьера Года I)`,
  };
}

export function calculateDualDating(input: DualDatingInput): DualDatingResult {
  const mName = DEFAULT_MONTH_NAMES_GENITIVE[input.month - 1] || 'Марта';
  let gapDays = 10;
  if (input.year >= 1700 && input.year < 1800) gapDays = 11;
  else if (input.year >= 1800 && input.year < 1900) gapDays = 12;
  else if (input.year >= 1900 && input.year < 2100) gapDays = 13;
  else if (input.year < 1582) gapDays = 0;

  const newDay = input.day + gapDays;
  let nsDateStr = `${newDay} ${mName} ${input.year} г.`;
  if (gapDays > 0) nsDateStr += ` (+${gapDays} дн)`;

  const mabsMinutes = (input.year * 365 + input.month * 30 + input.day) * 1440;
  const quoteStr = gapDays > 0
    ? `«${input.day} (${newDay}) ${mName} ${input.year} года»`
    : `«${input.day} ${mName} ${input.year} года»`;

  return {
    osDateStr: `${input.day} ${mName} ${input.year} г.`,
    nsDateStr,
    mabsMinutes,
    quoteStr,
  };
}

export function formatSliderTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
