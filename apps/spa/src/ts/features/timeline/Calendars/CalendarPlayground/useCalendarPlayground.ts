import { ref, computed, watch } from 'vue';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export function useCalendarPlayground(props: { calendar: CalendarData }) {
  const isCollapsed = ref(false);

  const filters = ref({
    seasons: true,
    moons: true,
    holidays: true
  });

  const initOrigin = () => {
    if (!props.calendar.точка_отсчета) {
      props.calendar.точка_отсчета = {
        эпоха: 0,
        год: 1,
        месяц: 0,
        день: 1,
        день_недели: 0
      };
    }
  };

  watch(() => props.calendar, () => initOrigin(), { immediate: true });

  const origin = computed(() => props.calendar.точка_отсчета!);

  const daysInWeek = computed(() => props.calendar.дней_в_неделе || 7);
  const weekdayNames = computed(() => {
    const names = props.calendar.названия_дней_недели || [];
    return Array.from({ length: daysInWeek.value }).map((_, i) => names[i] || `День ${i + 1}`);
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
    'Зима': 'rgba(100, 150, 255, 0.1)',
    'Весна': 'rgba(100, 255, 150, 0.1)',
    'Лето': 'rgba(255, 200, 100, 0.1)',
    'Осень': 'rgba(255, 150, 50, 0.1)',
  };

  const gridDays = computed(() => {
    const days = [];
    const count = currentDaysCount.value;
    const cal = props.calendar;
    
    for (let i = 1; i <= count; i++) {
      const inputDate = { era_index: origin.value.эпоха ?? 0, year: origin.value.год, month: origin.value.месяц, day: i, hour: 12, minute: 0 };
      const absMinute = CalendarMath.getAbsoluteMinute(inputDate, cal);
      
      let moons: any[] = [];
      if (filters.value.moons) {
        moons = CalendarMath.calculateMoonPhases(absMinute, cal.moons || [], cal);
      }

      let seasonColor = 'transparent';
      let seasonName = '';
      if (filters.value.seasons) {
        seasonName = CalendarMath.getSeasonForDate(cal, inputDate.year, inputDate.month);
        seasonColor = seasonColorsMap[seasonName] || 'rgba(255,255,255,0.03)';
      }

      let holiday = null;
      if (filters.value.holidays) {
         holiday = getHolidayForDate(cal, inputDate.year, inputDate.month, i);
      }
      
      const isOrigin = (origin.value.год === inputDate.year && origin.value.месяц === inputDate.month && origin.value.день === i);

      days.push({
        day: i,
        absMinute,
        moons,
        seasonName,
        seasonColor,
        holidayText: holiday ? holiday.название : '',
        isOrigin
      });
    }
    return days;
  });

  const getDayTooltip = (day: any) => {
    const lines = [`День ${day.day}`];
    if (day.seasonName && filters.value.seasons) lines.push(`❄️ ${day.seasonName}`);
    if (day.holidayText && filters.value.holidays) lines.push(`🎉 Праздник: ${day.holidayText}`);
    if (day.moons && day.moons.length && filters.value.moons) {
      day.moons.forEach((m: any) => {
        lines.push(`${m.emoji} ${m.moon.name}: ${m.name}`);
      });
    }
    if (day.isOrigin) lines.push(`🌟 Точка отсчета (День 0)`);
    return lines.join('\n');
  };

  return {
    isCollapsed,
    filters,
    origin,
    daysInWeek,
    weekdayNames,
    prevMonth,
    nextMonth,
    currentDaysCount,
    startWeekdayOffset,
    gridDays,
    getDayTooltip,
    isSignificantPhase
  };
}
