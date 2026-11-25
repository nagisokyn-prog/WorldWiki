import { computed, type Ref } from 'vue';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarMonth, CalendarEra, CalendarSeason } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { DatePrecision, TimeOfDayPreset } from '@/types/narrative';
import type { DiegeticDateBadgeInfo, DialDeltaChip } from './PromiseCardMeta.model';

const TIME_OF_DAY_LABELS: Record<TimeOfDayPreset, string> = {
  morning: '🌅 Утро',
  day: '☀️ День',
  evening: '🌇 Вечер',
  night: '🌙 Ночь'
};

export function usePromiseDateHelpers(
  activeCalendar: Ref<CalendarRecord | null>,
  activeCalendarMonths: Ref<CalendarMonth[]>,
  activeCalendarEras: Ref<CalendarEra[]>,
  maxDaysInCurrentMonth: Ref<number>,
  currentYear: Ref<number>,
  currentEraIdx: Ref<number>,
  currentMonthIdx: Ref<number>,
  currentDay: Ref<number>,
  currentHour: Ref<number>,
  currentMinute: Ref<number>,
  getCalendarData: (cal: CalendarRecord | null) => CalendarData | null,
  fuzzyRefs?: {
    datePrecision: Ref<DatePrecision>;
    isApproximate: Ref<boolean>;
    timeOfDay: Ref<TimeOfDayPreset | null>;
    endYear: Ref<number>;
    endMonthIdx: Ref<number>;
    currentSeasonIdx: Ref<number>;
  }
) {
  const eraWheelOptions = computed(() => {
    return activeCalendarEras.value.map((e, idx) => ({
      value: idx,
      label: e.название || e.name || `Эпоха ${idx + 1}`
    }));
  });

  const currentEra = computed(() => {
    return activeCalendarEras.value[currentEraIdx.value] || activeCalendarEras.value[0] || { год_начала: 1, год_конца: 9999, название: '' };
  });

  const eraMinYear = computed(() => {
    return currentEra.value.год_начала !== undefined ? currentEra.value.год_начала : 1;
  });

  const eraMaxYear = computed(() => {
    return currentEra.value.год_конца !== undefined ? currentEra.value.год_конца : (eraMinYear.value + 100);
  });

  const yearWheelOptions = computed(() => {
    const minStart = eraMinYear.value;
    const maxEnd = eraMaxYear.value;
    const y = Number(currentYear.value) || minStart;

    let min = minStart;
    let max = Math.min(maxEnd, minStart + 100);

    if (y > minStart + 100) {
      min = Math.max(minStart, y - 50);
      max = Math.min(maxEnd, y + 50);
    }

    const list: Array<{ value: number; label: string }> = [];
    for (let i = min; i <= max; i++) {
      list.push({ value: i, label: String(i) });
    }
    return list;
  });

  const monthWheelOptions = computed(() => {
    return activeCalendarMonths.value.map((m, idx) => ({
      value: idx,
      label: m.название || `Месяц ${idx + 1}`
    }));
  });

  const dayWheelOptions = computed(() => {
    return Array.from({ length: maxDaysInCurrentMonth.value }, (_, i) => ({
      value: i + 1,
      label: String(i + 1)
    }));
  });

  const hourWheelOptions = computed(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      value: i,
      label: String(i).padStart(2, '0')
    }));
  });

  const minuteWheelOptions = computed(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      value: i,
      label: String(i).padStart(2, '0')
    }));
  });

  const getSeasonClass = (seasonName: string): string => {
    const s = seasonName.toLowerCase();
    if (s.includes('весн') || s.includes('spring')) return 'season-spring';
    if (s.includes('лет') || s.includes('summer')) return 'season-summer';
    if (s.includes('осен') || s.includes('autumn') || s.includes('fall')) return 'season-autumn';
    if (s.includes('зим') || s.includes('winter')) return 'season-winter';
    return 'season-default';
  };

  const getTimeOfDay = (hour: number = 0): string => {
    const h = Number(hour) || 0;
    if (h >= 5 && h < 12) return '🌅 Утро';
    if (h >= 12 && h < 18) return '☀️ День';
    if (h >= 18 && h < 23) return '🌇 Вечер';
    return '🌙 Ночь';
  };

  const calendarSeasons = computed<CalendarSeason[]>(() => {
    const calData = getCalendarData(activeCalendar.value);
    return Array.isArray(calData?.сезоны) ? calData.сезоны : [];
  });

  const seasonWheelOptions = computed(() =>
    calendarSeasons.value.map((s, idx) => ({
      value: idx,
      label: s.название
    }))
  );

  const dialDeltaChips = computed<DialDeltaChip[]>(() => {
    const calData = getCalendarData(activeCalendar.value);
    if (!calData) return [];

    const timeSettings = (calData as CalendarData & { настройки_времени?: { часов_в_сутках?: number; минут_в_часе?: number } }).настройки_времени;
    const hoursPerDay = Number(timeSettings?.часов_в_сутках) || 24;
    const minutesPerHour = Number(timeSettings?.минут_в_часе) || 60;
    const dayMinutes = hoursPerDay * minutesPerHour;

    const rawUnits = Array.isArray(calData.dial_hierarchy?.units) && calData.dial_hierarchy.units.length > 0
      ? calData.dial_hierarchy.units
      : [
          { name: 'Час', subdivisions: hoursPerDay },
          { name: 'Минута', subdivisions: minutesPerHour }
        ];

    const chips: DialDeltaChip[] = [];
    let currentMinutes = dayMinutes;
    for (let i = 0; i < rawUnits.length; i++) {
      const unit = rawUnits[i];
      if (!unit) continue;
      const sub = Math.max(1, Number(unit.subdivisions) || 1);
      currentMinutes = currentMinutes / sub;
      if (currentMinutes < 1) continue;
      const cleanName = String(unit.name || '').trim();
      if (!cleanName) continue;
      const letter = cleanName.charAt(0).toLowerCase();
      chips.push({
        label: `+1${letter}`,
        title: `+1 ${cleanName}`,
        deltaMinutes: Math.round(currentMinutes)
      });
    }
    chips.unshift({ label: '+1д', title: '+1 День', deltaMinutes: dayMinutes });
    return chips.reverse();
  });

  const diegeticInfo = computed<DiegeticDateBadgeInfo | null>(() => {
    const cal = activeCalendar.value;
    const calData = getCalendarData(cal);
    if (!cal || !calData) return null;

    const input = {
      era_index: Number(currentEraIdx.value) || 0,
      year: Number(currentYear.value) || 1,
      month: Number(currentMonthIdx.value) || 0,
      day: Number(currentDay.value) || 1,
      hour: Number(currentHour.value) || 0,
      minute: Number(currentMinute.value) || 0
    };

    const precision: DatePrecision = fuzzyRefs?.datePrecision.value || 'exact';
    const approxPrefix = fuzzyRefs?.isApproximate.value ? '≈ ' : '';
    const explicitTod = fuzzyRefs?.timeOfDay.value || null;

    const seasonName = CalendarFormat.getSeasonForDate(calData, input.year, input.month);
    const hasValidSeason = Boolean(seasonName && seasonName !== 'Вне сезона' && calendarSeasons.value.length > 0);
    const seasonClass = getSeasonClass(seasonName || '');
    const mAbs = CalendarMath.getAbsoluteMinute(input, calData);

    const eraName = activeCalendarEras.value[input.era_index]?.название || '';
    const eraSuffix = eraName ? ` (${eraName})` : '';
    const monthName = activeCalendarMonths.value[input.month]?.название || `Месяц ${input.month + 1}`;

    let formattedDate = '';
    let timeOfDayName = '';

    if (precision === 'exact') {
      const fmt = CalendarFormat.formatDate(calData, {
        original_input: input,
        calendar_id: cal.id || '',
        absolute_minute: mAbs
      });
      const fallbackDate = `${input.year} год, ${monthName} ${input.day}${eraSuffix} в ${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}`;
      formattedDate = `${approxPrefix}${fmt || fallbackDate}`;
      timeOfDayName = explicitTod
        ? TIME_OF_DAY_LABELS[explicitTod]
        : (input.hour !== 0 || input.minute !== 0 ? getTimeOfDay(input.hour) : '');
    } else if (precision === 'day') {
      formattedDate = `${approxPrefix}${input.year} г., ${monthName} ${input.day}${eraSuffix}`;
      timeOfDayName = explicitTod ? TIME_OF_DAY_LABELS[explicitTod] : '';
    } else if (precision === 'month') {
      formattedDate = `${approxPrefix}${monthName} ${input.year}${eraSuffix}`;
    } else if (precision === 'season') {
      const sIdx = fuzzyRefs?.currentSeasonIdx.value ?? 0;
      const chosenSeason = calendarSeasons.value[sIdx]?.название || seasonName || '';
      formattedDate = `${approxPrefix}${chosenSeason ? `${chosenSeason} ` : ''}${input.year}${eraSuffix}`;
    } else if (precision === 'year') {
      formattedDate = `${approxPrefix}${input.year} г.${eraSuffix}`;
    } else if (precision === 'range') {
      const eYear = fuzzyRefs?.endYear.value ?? input.year;
      const eMonthIdx = fuzzyRefs?.endMonthIdx.value ?? input.month;
      const endMonthName = activeCalendarMonths.value[eMonthIdx]?.название || `Месяц ${eMonthIdx + 1}`;
      if (eYear === input.year) {
        formattedDate = `${approxPrefix}${monthName} — ${endMonthName} ${input.year}${eraSuffix}`;
      } else {
        formattedDate = `${approxPrefix}${monthName} ${input.year} — ${endMonthName} ${eYear}${eraSuffix}`;
      }
    }

    return {
      calendarName: cal.name || 'Календарь',
      seasonName: (precision === 'year' || precision === 'season') ? '' : (hasValidSeason ? seasonName : ''),
      seasonClass,
      timeOfDayName,
      formattedDate,
      mAbs
    };
  });

  return {
    eraWheelOptions,
    yearWheelOptions,
    monthWheelOptions,
    dayWheelOptions,
    hourWheelOptions,
    minuteWheelOptions,
    calendarSeasons,
    seasonWheelOptions,
    dialDeltaChips,
    diegeticInfo,
    eraMinYear,
    eraMaxYear
  };
}
