import { computed, ref } from 'vue';
import type {
  Tab4PlaygroundProps,
  Tab4PlaygroundEmits,
  StoryOriginDateDto,
} from './Tab4Playground.model';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';

export function useTab4Playground(
  props: Tab4PlaygroundProps,
  emit: Tab4PlaygroundEmits
) {
  // Точка отсчета 1-й главы сюжета
  const storyOrigin = computed<StoryOriginDateDto>(() => {
    const raw = props.calendarData?.точка_отсчета as any;
    return {
      era_index: Number(raw?.эпоха) || 0,
      year: Number(raw?.год) || 1024,
      month: Number(raw?.месяц) || 2, // Март по умолчанию
      day: Number(raw?.день) || 15,
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

  // Дни для матрицы месяца
  const monthMatrixDays = computed(() => {
    if (!props.calendarData) return [];
    const cal = props.calendarData;
    const totalDays = CalendarEngine.getDaysInMonth(cal, testYear.value, testMonth.value);
    const weekdaysList = cal.названия_дней_недели || ['День'];
    const weekdaysCount = Math.max(1, weekdaysList.length);

    const days = [];
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const weekdayIdx = (dayNum - 1) % weekdaysCount;
      const isHol = CalendarEngine.isHoliday(cal, testYear.value, testMonth.value, dayNum);
      days.push({
        day: dayNum,
        weekdayName: weekdaysList[weekdayIdx] || `День ${weekdayIdx + 1}`,
        isHoliday: isHol,
        isSelected: dayNum === testDay.value,
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
        час: updated.hour,
        минута: updated.minute,
      } as any,
    });
  }

  function selectMatrixDay(day: number) {
    testDay.value = day;
  }

  return {
    storyOrigin,
    testYear,
    testMonth,
    testDay,
    liveCalculation,
    monthMatrixDays,
    updateOrigin,
    selectMatrixDay,
  };
}
