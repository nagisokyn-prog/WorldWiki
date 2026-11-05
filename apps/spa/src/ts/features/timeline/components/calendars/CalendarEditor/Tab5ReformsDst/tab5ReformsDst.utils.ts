/**
 * @file tab5ReformsDst.utils.ts
 * @description Чистые функции расчета дат реформ, двойной датировки и симулятора DST.
 */

import type {
  DstPolicyConfig,
  DstPresetKey,
  DualDatingInput,
  DualDatingResult,
  GapReformParams,
  ReformMode,
  ReformPresetKey,
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

export interface ReformPresetDefinition {
  mode: ReformMode;
  gapParams?: GapReformParams;
  transParams?: TransitionalReformParams;
  resetParams?: ResetReformParams;
  dualDatingInput: DualDatingInput;
}

export const REFORM_PRESETS: Record<ReformPresetKey, ReformPresetDefinition> = {
  gregorian_1582: {
    mode: 'gap',
    gapParams: { oldDay: 4, oldMonth: 10, oldYear: 1582, droppedDays: 10 },
    dualDatingInput: { day: 12, month: 3, year: 1600 },
  },
  caesar_46bc: {
    mode: 'transitional',
    transParams: { transitionalYear: -46, addedDays: 90 },
    dualDatingInput: { day: 1, month: 1, year: -45 },
  },
  russia_1918: {
    mode: 'gap',
    gapParams: { oldDay: 31, oldMonth: 1, oldYear: 1918, droppedDays: 13 },
    dualDatingInput: { day: 14, month: 2, year: 1918 },
  },
  french_1792: {
    mode: 'reset',
    resetParams: { resetDay: 22, resetMonth: 9, resetYearOld: 1792, resetToYear: 1 },
    dualDatingInput: { day: 14, month: 7, year: 1793 },
  },
  fantasy_magic: {
    mode: 'gap',
    gapParams: { oldDay: 24, oldMonth: 6, oldYear: 1024, droppedDays: 7 },
    dualDatingInput: { day: 1, month: 1, year: 1024 },
  },
};

export const DST_PRESETS: Record<DstPresetKey, DstPolicyConfig> = {
  eu_standard: {
    isEnabled: true,
    policy: 'relative',
    shiftMinutes: 60,
    springRule: { month: 3, occurrence: 'last', weekday: 6, fixedDay: 25, time: '02:00' },
    autumnRule: { month: 10, occurrence: 'last', weekday: 6, fixedDay: 25, time: '03:00' },
  },
  us_standard: {
    isEnabled: true,
    policy: 'relative',
    shiftMinutes: 60,
    springRule: { month: 3, occurrence: 'second', weekday: 6, fixedDay: 10, time: '02:00' },
    autumnRule: { month: 11, occurrence: 'first', weekday: 6, fixedDay: 5, time: '02:00' },
  },
  fixed_dates: {
    isEnabled: true,
    policy: 'fixed',
    shiftMinutes: 60,
    springRule: { month: 3, occurrence: 'last', weekday: 6, fixedDay: 25, time: '02:00' },
    autumnRule: { month: 10, occurrence: 'last', weekday: 6, fixedDay: 25, time: '03:00' },
  },
  fantasy_harvest: {
    isEnabled: true,
    policy: 'fixed',
    shiftMinutes: 120,
    springRule: { month: 4, occurrence: 'first', weekday: 0, fixedDay: 1, time: '04:00' },
    autumnRule: { month: 7, occurrence: 'last', weekday: 0, fixedDay: 30, time: '04:00' },
  },
  none: {
    isEnabled: false,
    policy: 'none',
    shiftMinutes: 0,
    springRule: { month: 3, occurrence: 'last', weekday: 6, fixedDay: 25, time: '02:00' },
    autumnRule: { month: 10, occurrence: 'last', weekday: 6, fixedDay: 25, time: '03:00' },
  },
};

export function getSpringAlertData(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  if (h === 2) {
    return {
      title: 'НЕДОПУСТИМОЕ ЛОКАЛЬНОЕ ВРЕМЯ (GAP)',
      desc: `В эти сутки часа с 02:00 до 02:59 физически не существовало! Стрелки перескочили с 01:59 на 03:00. Система нормализует введенное писателем время в 03:${m} (UTC+1, +60 мин).`,
      style: { background: 'var(--danger-bg)', borderColor: 'var(--accent-danger)' },
      textColor: 'var(--accent-danger)',
    };
  }
  if (h >= 3) {
    return {
      title: 'ЛЕТНЕЕ ВРЕМЯ АКТИВНО',
      desc: '✓ Летнее время активно. Смещение часового пояса: +60 минут (UTC+1). M_abs строго привязана к оси времени.',
      style: { background: 'var(--success-bg)', borderColor: 'var(--accent-success)' },
      textColor: 'var(--accent-success)',
    };
  }
  return {
    title: 'ЗИМНЕЕ ВРЕМЯ (UTC+0)',
    desc: `Стандартное зимнее время (UTC+0). До перевода стрелок вперед осталось ${120 - minutes} мин.`,
    style: { background: 'var(--info-bg)', borderColor: 'var(--accent-primary)' },
    textColor: 'var(--accent-primary)',
  };
}

export function getAutumnAlertData(minutes: number, fold: number, timeStr: string) {
  const h = Math.floor(minutes / 60);
  if (h === 2) {
    const desc = fold === 0
      ? `Час ${timeStr} повторяется дважды! Флаг fold: 0 указывает на первое прохождение (до перевода стрелок, лето UTC+1).`
      : `Час ${timeStr} повторяется дважды! Флаг fold: 1 указывает на второе прохождение (после перевода назад, зима UTC+0). В хронологии разница 60 минут!`;
    return {
      desc,
      style: { background: 'var(--bg-surface-elevated)', borderColor: 'var(--accent-purple)' },
    };
  }
  if (h >= 3) {
    return {
      desc: '✓ Стрелки уже переведены назад. Действует стандартное зимнее время (UTC+0).',
      style: { background: 'var(--bg-surface-elevated)', borderColor: 'var(--accent-purple)' },
    };
  }
  return {
    desc: `Действует летнее время (UTC+1). До перевода стрелок назад осталось ${180 - minutes} мин.`,
    style: { background: 'var(--bg-surface-elevated)', borderColor: 'var(--accent-purple)' },
  };
}
