import { ref, onMounted } from "vue";
import { settingsService, type AppSettings } from '@worldwiki/components';
import { CalendarMath } from "../../../../services/Calendars/useCalendarEngine";
import type { CalendarData } from "../../../../services/Calendars/calendar.types";

export function useCalendarHolidays(props: { modelValue: CalendarData }, _emit?: (event: string, ...args: unknown[]) => void) {
  const isCollapsed = ref(false);

  const getDaysInMonth = (cal: CalendarData, year: number, monthIdx: number) => CalendarMath.getDaysInMonth(cal, year, monthIdx);

  const wheelHorizontal = ref(
    settingsService.getSettings()?.dropdowns?.wheelOrientation === "horizontal",
  );

  onMounted(() => {
    settingsService.onChange(
      (s: AppSettings) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === "horizontal"),
    );
  });

  const moveItem = (idx: number, delta: number) => {
    const arr = props.modelValue.праздники;
    if (!arr) return;
    const n = idx + delta;
    if (n >= 0 && n < arr.length) {
      [arr[idx], arr[n]] = [arr[n], arr[idx]];
    }
  };

  const addHoliday = () => {
    if (!props.modelValue.праздники) props.modelValue.праздники = [];
    props.modelValue.праздники.push({
      название: `Праздник ${props.modelValue.праздники.length + 1}`,
      дата_начала: { месяц: 0, день: 1 },
      дата_конца: { месяц: 0, день: 1 },
    });
  };

  const removeHoliday = (idx: number) => {
    if (props.modelValue.праздники) {
      props.modelValue.праздники.splice(idx, 1);
    }
  };

  const toggleHolidayRange = (holiday: { дата_начала: { месяц: number; день: number }; дата_конца?: { месяц: number; день: number } }) => {
    if (holiday.дата_конца) {
      delete holiday.дата_конца;
    } else {
      holiday.дата_конца = { ...holiday.дата_начала };
    }
  };

  const isNewYearCrossing = (holiday: { дата_начала: { месяц: number; день: number }; дата_конца?: { месяц: number; день: number } }): boolean => {
    if (!holiday.дата_конца) return false;
    if (holiday.дата_конца.месяц < holiday.дата_начала.месяц) return true;
    if (holiday.дата_конца.месяц === holiday.дата_начала.месяц && holiday.дата_конца.день < holiday.дата_начала.день) return true;
    return false;
  };

  return {
    isCollapsed,
    wheelHorizontal,
    getDaysInMonth,
    moveItem,
    addHoliday,
    removeHoliday,
    toggleHolidayRange,
    isNewYearCrossing
  };
}
