import { ref, computed, watch } from 'vue';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';
import type { CalendarData, MoonPhaseResult } from '../../../../services/Calendars/calendar.types';
import type { CalendarPlaygroundProps } from './CalendarPlayground.model';

export function useCalendarPlayground(
  props: CalendarPlaygroundProps,
  emit?: (event: 'set-origin') => void
) {
  const isCollapsed = ref(true);

  const filters = ref({
    seasons: true,
    moons: true,
    holidays: true
  });

  const initOrigin = () => {
    const firstEra = props.calendar.эпохи?.[0];
    const startYear = firstEra ? (firstEra.год_начала ?? 1) : 1;
    if (!props.calendar.точка_отсчета) {
      props.calendar.точка_отсчета = {
        эпоха: 0,
        год: startYear,
        месяц: 0,
        день: 1,
        день_недели: 0
      };
    }
  };

  const handleHeaderClick = () => {
    if (!props.calendar.is_story_origin) return;
    isCollapsed.value = !isCollapsed.value;
  };

  const toggleStoryOrigin = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    props.calendar.is_story_origin = checked;
    if (checked) {
      initOrigin();
      isCollapsed.value = false;
      emit?.('set-origin');
    } else {
      isCollapsed.value = true;
    }
  };

  watch(() => [props.calendar._id, props.calendar.название], () => initOrigin(), { immediate: true });

  const origin = computed(() => props.calendar.точка_отсчета!);

  const daysInWeek = computed(() => props.calendar.дней_в_неделе || 7);
  const weekdayNames = computed(() => {
    const names = props.calendar.названия_дней_недели || [];
    return Array.from({ length: daysInWeek.value }).map((_, i) => names[i] || `День ${i + 1}`);
  });

  const shortWeekdayNames = computed(() => {
    return weekdayNames.value.map((name) => name.slice(0, 3));
  });

  const prevMonth = () => {
    if (origin.value.месяц > 0) {
      origin.value.месяц--;
    } else {
      origin.value.месяц = (props.calendar.месяцы?.length || 1) - 1;
      origin.value.год--;
    }
  };

  const nextMonth = () => {
    if (origin.value.месяц < (props.calendar.месяцы?.length || 1) - 1) {
      origin.value.месяц++;
    } else {
      origin.value.месяц = 0;
      origin.value.год++;
    }
  };

  const currentDaysCount = computed(() => {
    return CalendarMath.getDaysInMonth(props.calendar, origin.value.год, origin.value.месяц);
  });

  const startWeekdayOffset = computed(() => {
    const inputDate = { era_index: origin.value.эпоха ?? 0, year: origin.value.год, month: origin.value.месяц, day: 1, hour: 12, minute: 0 };
    const absMinute = CalendarMath.getAbsoluteMinute(inputDate, props.calendar);
    
    const originDate = { 
      era_index: props.calendar.точка_отсчета?.эпоха ?? 0, 
      year: props.calendar.точка_отсчета?.год ?? 1, 
      month: props.calendar.точка_отсчета?.месяц ?? 0, 
      day: props.calendar.точка_отсчета?.день ?? 1, 
      hour: 12, minute: 0 
    };
    const originAbsMinute = CalendarMath.getAbsoluteMinute(originDate, props.calendar);

    const settings = props.calendar.настройки_времени;
    const minutesInDay = (settings?.часов_в_сутках || 24) * (settings?.минут_в_часе || 60);
    
    const absoluteDay = Math.floor(absMinute / minutesInDay);
    const originAbsoluteDay = Math.floor(originAbsMinute / minutesInDay);
    
    const startOffset = props.calendar.точка_отсчета?.день_недели || 0;
    return ((absoluteDay - originAbsoluteDay + startOffset) % daysInWeek.value + daysInWeek.value) % daysInWeek.value;
  });

  const getHolidayForDate = (cal: CalendarData, year: number, monthIdx: number, day: number) => {
    if (!cal || !cal.праздники) return null;
    for (const h of cal.праздники) {
      const sm = h.дата_начала.месяц, sd = h.дата_начала.день;
      const em = h.дата_конца?.месяц ?? sm, ed = h.дата_конца?.день ?? sd;
      if (monthIdx >= sm && monthIdx <= em) {
        if (monthIdx === sm && monthIdx === em) {
          if (day >= sd && day <= ed) return h;
        } else if (monthIdx === sm) {
          if (day >= sd) return h;
        } else if (monthIdx === em) {
          if (day <= ed) return h;
        } else {
          return h;
        }
      }
    }
    return null;
  };

  const isSignificantPhase = (phase: number) => {
    return phase < 0.05 || phase > 0.95 || Math.abs(phase - 0.5) < 0.05;
  };

  const seasonColorsMap: Record<string, string> = {
    'Зима': 'var(--info-bg)',
    'Весна': 'var(--success-bg)',
    'Лето': 'var(--warning-bg)',
    'Осень': 'var(--error-bg)',
  };

  const getDayTooltip = (day: { day: number; seasonName?: string; holidayText?: string; moons?: Array<{ emoji?: string; name?: string; moon?: { name?: string } }>; isOrigin?: boolean }) => {
    const lines = [`День ${day.day}`];
    if (day.seasonName && filters.value.seasons) lines.push(`❄️ ${day.seasonName}`);
    if (day.holidayText && filters.value.holidays) lines.push(`🎉 Праздник: ${day.holidayText}`);
    if (day.moons && day.moons.length && filters.value.moons) {
      day.moons.forEach((m) => {
        lines.push(`${m.emoji || ''} ${m.moon?.name || ''}: ${m.name || ''}`);
      });
    }
    if (day.isOrigin) lines.push(`🌟 Точка отсчета (День 0)`);
    return lines.join('\n');
  };

  const gridDays = computed(() => {
    const days = [];
    const count = currentDaysCount.value;
    const cal = props.calendar;
    
    for (let i = 1; i <= count; i++) {
      const inputDate = { era_index: origin.value.эпоха ?? 0, year: origin.value.год, month: origin.value.месяц, day: i, hour: 12, minute: 0 };
      const absMinute = CalendarMath.getAbsoluteMinute(inputDate, cal);
      
      let moons: MoonPhaseResult[] = [];
      if (filters.value.moons) {
        moons = CalendarMath.calculateMoonPhases(absMinute, cal.moons || [], cal);
      }

      let seasonColor = 'transparent';
      let seasonName = '';
      if (filters.value.seasons) {
        seasonName = CalendarMath.getSeasonForDate(cal, inputDate.year, inputDate.month);
        const seasonObj = cal.сезоны?.find(s => s.название === seasonName);
        seasonColor = seasonObj?.цвет || seasonColorsMap[seasonName] || 'var(--bg-sunken)';
      }

      let holiday = null;
      if (filters.value.holidays) {
         holiday = getHolidayForDate(cal, inputDate.year, inputDate.month, i);
      }
      
      const isOrigin = (origin.value.год === inputDate.year && origin.value.месяц === inputDate.month && origin.value.день === i);

      const dayObj = {
        day: i,
        absMinute,
        moons,
        seasonName,
        seasonColor,
        holidayText: holiday ? holiday.название : '',
        isOrigin
      };

      days.push({
        ...dayObj,
        tooltip: getDayTooltip(dayObj)
      });
    }
    return days;
  });

  return {
    isCollapsed,
    handleHeaderClick,
    toggleStoryOrigin,
    filters,
    origin,
    daysInWeek,
    weekdayNames,
    shortWeekdayNames,
    prevMonth,
    nextMonth,
    currentDaysCount,
    startWeekdayOffset,
    gridDays,
    getDayTooltip,
    isSignificantPhase
  };
}
