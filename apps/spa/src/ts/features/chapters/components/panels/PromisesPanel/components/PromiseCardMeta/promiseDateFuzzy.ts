import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData, CalendarMonth, CalendarSeason } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { DatePrecision } from '@/types/narrative';

export function extractCalendarData(cal: CalendarRecord | null): CalendarData | null {
  if (!cal) return null;
  if (cal.data && typeof cal.data === 'object' && 'data' in cal.data && typeof (cal.data as Record<string, unknown>).data === 'object') {
    return (cal.data as Record<string, unknown>).data as CalendarData;
  }
  return (cal.data as CalendarData) || null;
}

export function resolveEraIndexForMabs(
  mAbs: number,
  calData: CalendarData,
  explicitEraIdx?: number
): number {
  const isEventBCE = mAbs < 0;
  const baseEraIdx = calData.эпохи && calData.эпохи.length > 0
    ? Math.max(0, calData.эпохи.findIndex((e) => !!e.обратный_отсчет === isEventBCE))
    : 0;

  if (explicitEraIdx !== undefined && calData.эпохи && explicitEraIdx >= 0 && explicitEraIdx < calData.эпохи.length) {
    return explicitEraIdx;
  }
  if (!calData.эпохи || calData.эпохи.length === 0) return baseEraIdx;

  const rawDate = CalendarMath.getDateFromAbsolute(mAbs, calData, baseEraIdx);
  let matched = calData.эпохи.findIndex((era) => {
    if (!!era.обратный_отсчет !== isEventBCE) return false;
    const start = era.год_начала ?? 1;
    const end = era.год_конца ?? Infinity;
    return rawDate.year >= start && rawDate.year <= end;
  });
  if (matched === -1) {
    matched = calData.эпохи.findIndex((era) => {
      const start = era.год_начала ?? 1;
      const end = era.год_конца ?? Infinity;
      return rawDate.year >= start && rawDate.year <= end;
    });
  }
  return matched !== -1 ? matched : baseEraIdx;
}

export function computeFuzzyEndMabs(params: {
  calData: CalendarData;
  months: CalendarMonth[];
  seasons: CalendarSeason[];
  precision: DatePrecision;
  eraIdx: number;
  startYear: number;
  startMonthIdx: number;
  endYear: number;
  endMonthIdx: number;
  seasonIdx: number;
}): number | null {
  const { calData, months, seasons, precision, eraIdx, startYear, startMonthIdx, endYear, endMonthIdx, seasonIdx } = params;
  if (precision === 'exact' || precision === 'day') return null;

  const lastMonthIdx = Math.max(0, months.length - 1);
  let targetYear = Number(startYear) || 1;
  let targetMonth = Number(startMonthIdx) || 0;

  if (precision === 'range') {
    targetYear = Number(endYear) || targetYear;
    targetMonth = Math.min(lastMonthIdx, Math.max(0, Number(endMonthIdx) || 0));
  } else if (precision === 'year') {
    targetMonth = lastMonthIdx;
  } else if (precision === 'season') {
    const season = seasons[seasonIdx];
    if (season && season.месяцы.length > 0) {
      targetMonth = season.месяцы[season.месяцы.length - 1] ?? targetMonth;
    }
  }

  const daysInTargetMonth = months[targetMonth]?.дней || 30;
  return CalendarMath.getAbsoluteMinute(
    { era_index: eraIdx, year: targetYear, month: targetMonth, day: daysInTargetMonth, hour: 23, minute: 59 },
    calData
  );
}

export function applyCompoundDateShift(params: {
  calData: CalendarData;
  eraIdx: number;
  year: number;
  monthIdx: number;
  day: number;
  hour: number;
  minute: number;
  sign: 1 | -1;
  years?: number;
  months?: number;
  days?: number;
  dialUnits?: Record<string, number>;
  dialChips: Array<{ label: string; deltaMinutes: number }>;
}): number {
  const { calData, eraIdx, hour, minute, sign, dialChips } = params;
  const monthCount = Math.max(1, calData.месяцы?.length || 12);

  // 1. Календарная часть: годы и месяцы с корректным переносом и зажимом дня
  const deltaYears = (Math.floor(Number(params.years) || 0)) * sign;
  const deltaMonths = (Math.floor(Number(params.months) || 0)) * sign;
  const totalMonthOffset = (Number(params.monthIdx) || 0) + deltaMonths;
  const yearCarry = Math.floor(totalMonthOffset / monthCount);
  const nextMonth = ((totalMonthOffset % monthCount) + monthCount) % monthCount;
  const nextYear = Math.max(1, (Number(params.year) || 1) + deltaYears + yearCarry);
  const maxDay = CalendarMath.getDaysInMonth(calData, nextYear, nextMonth);
  const nextDay = Math.min(maxDay, Math.max(1, Number(params.day) || 1));

  const baseMabs = CalendarMath.getAbsoluteMinute(
    { era_index: eraIdx, year: nextYear, month: nextMonth, day: nextDay, hour, minute },
    calData
  );

  // 2. Линейная часть: дни + единицы циферблата активного календаря
  const timeSettings = (calData as CalendarData & { настройки_времени?: { часов_в_сутках?: number; минут_в_часе?: number } }).настройки_времени;
  const dayMinutes = (Number(timeSettings?.часов_в_сутках) || 24) * (Number(timeSettings?.минут_в_часе) || 60);

  let linearMinutes = (Math.floor(Number(params.days) || 0)) * dayMinutes;
  if (params.dialUnits) {
    const unitMap = new Map<string, number>();
    for (const c of dialChips) {
      unitMap.set(c.label.replace(/^\+1/, ''), c.deltaMinutes);
    }
    for (const [k, count] of Object.entries(params.dialUnits)) {
      const unitMins = unitMap.get(k);
      if (unitMins && count > 0) {
        linearMinutes += Math.floor(count) * unitMins;
      }
    }
  }

  const totalLinearDelta = linearMinutes * sign;
  const era = calData.эпохи?.[eraIdx];
  const isReverse = Boolean(era?.обратный_отсчет || nextYear < 0);
  const signedDelta = isReverse ? -Math.round(totalLinearDelta) : Math.round(totalLinearDelta);

  return baseMabs + signedDelta;
}
