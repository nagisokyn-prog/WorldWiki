import { computed, ref } from 'vue';
import type {
  Tab4PlaygroundProps,
  Tab4PlaygroundEmits,
  StoryOriginDateDto,
} from './Tab4Playground.model';
import type { CalendarData, CalendarEra } from '@/services/Calendars/calendar.types';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';

export function useTab4Playground(
  props: Tab4PlaygroundProps,
  emit: Tab4PlaygroundEmits
) {
  // Эпохи календаря
  const eras = computed<CalendarEra[]>(() => {
    return props.calendarData?.эпохи || [
      { название: 'Наша эра (Anno Domini)', год_начала: 1, год_конца: 9999 },
    ];
  });

  // Точка отсчета 1-й главы сюжета
  const storyOrigin = computed<StoryOriginDateDto>(() => {
    const raw = props.calendarData?.точка_отсчета as Record<string, unknown> | undefined;
    return {
      era_index: Number(raw?.эпоха) || 0,
      year: Number(raw?.год) || 1024,
      month: Number(raw?.месяц) || 2, // Март по умолчанию
      day: Number(raw?.день) || 14,
      weekday_index: Number(raw?.день_недели) || 4, // Пятница
      hour: Number(raw?.час) || 14,
      minute: Number(raw?.минута) || 30,
    };
  });

  // Тестовая дата для живого тестера
  const testYear = ref(storyOrigin.value.year);
  const testMonth = ref(storyOrigin.value.month);
  const testDay = ref(storyOrigin.value.day);

  // Вычисляемые характеристики для тестовой даты
  const liveCalculation = computed(() => {
    if (!props.calendarData) return null;
    const cal = props.calendarData;
    const y = testYear.value;
    const m = testMonth.value;
    const d = testDay.value;

    const absMin = CalendarEngine.getAbsoluteMinute({ year: y, month: m, day: d }, cal);
    const season = CalendarEngine.getSeasonForDate(cal, y, m);
    const isHoliday = CalendarEngine.isHoliday(cal, y, m, d);
    const isLeap = CalendarEngine.isLeapYear(cal, y);

    return {
      absMinute: absMin,
      seasonName: season || 'Межсезонье',
      isHoliday,
      isLeapYear: isLeap,
    };
  });

  const monthNames = computed(() => {
    const months = props.calendarData?.месяцы;
    if (months && months.length > 0) {
      return months.map((m) => m.название);
    }
    return [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
    ];
  });

  const weekdayNames = computed(() => {
    const list = props.calendarData?.названия_дней_недели;
    if (list && list.length > 0) {
      return list;
    }
    return ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  });

  const currentMonthTitle = computed(() => {
    const name = monthNames.value[testMonth.value] || `Месяц ${testMonth.value + 1}`;
    const eraName = eras.value[storyOrigin.value.era_index]?.название || 'н.э.';
    return `${name} ${testYear.value} года (${eraName})`;
  });

  const weekdayHeaders = computed(() => {
    return weekdayNames.value.map((w) => w.slice(0, 2));
  });

  // Дни для матрицы месяца
  const monthMatrixDays = computed(() => {
    if (!props.calendarData) return [];
    const cal = props.calendarData;
    const totalDays = CalendarEngine.getDaysInMonth(cal, testYear.value, testMonth.value);
    const weekdaysList = weekdayNames.value;
    const weekdaysCount = Math.max(1, weekdaysList.length);

    const days = [];
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const weekdayIdx = (dayNum - 1) % weekdaysCount;
      const isHol = CalendarEngine.isHoliday(cal, testYear.value, testMonth.value, dayNum);
      const isOrigin =
        dayNum === storyOrigin.value.day &&
        testMonth.value === storyOrigin.value.month &&
        testYear.value === storyOrigin.value.year;

      days.push({
        day: dayNum,
        weekdayName: weekdaysList[weekdayIdx] || `День ${weekdayIdx + 1}`,
        weekdayShort: (weekdaysList[weekdayIdx] || `День ${weekdayIdx + 1}`).slice(0, 2),
        isHoliday: isHol,
        holidayName: isHol ? 'Праздник' : undefined,
        isSelected: dayNum === testDay.value,
        isStoryOrigin: isOrigin,
      });
    }
    return days;
  });

  function updateOrigin(patch: Partial<StoryOriginDateDto>) {
    const updated = { ...storyOrigin.value, ...patch };
    emit('update', {
      точка_отсчета: {
        эпоха: updated.era_index,
        год: updated.year,
        месяц: updated.month,
        день: updated.day,
        день_недели: updated.weekday_index,
        час: updated.hour,
        минута: updated.minute,
      } as CalendarData['точка_отсчета'],
    });
  }

  function selectMatrixDay(day: number) {
    testDay.value = day;
  }

  function prevMonth() {
    if (testMonth.value > 0) {
      testMonth.value--;
    } else {
      const maxM = Math.max(0, monthNames.value.length - 1);
      testMonth.value = maxM;
      testYear.value--;
    }
  }

  function nextMonth() {
    const maxM = Math.max(0, monthNames.value.length - 1);
    if (testMonth.value < maxM) {
      testMonth.value++;
    } else {
      testMonth.value = 0;
      testYear.value++;
    }
  }

  return {
    eras,
    storyOrigin,
    testYear,
    testMonth,
    testDay,
    currentMonthTitle,
    monthNames,
    weekdayNames,
    weekdayHeaders,
    liveCalculation,
    monthMatrixDays,
    updateOrigin,
    selectMatrixDay,
    prevMonth,
    nextMonth,
  };
}
