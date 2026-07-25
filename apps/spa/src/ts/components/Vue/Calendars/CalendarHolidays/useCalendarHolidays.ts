import { ref, onMounted } from "vue";
import { settingsService } from '@worldwiki/components';
import { CalendarMath } from "../../../../services/Calendars/calendar.math";
import type { CalendarData } from "../../../../services/Calendars/calendar.types";

export function useCalendarHolidays(props: { modelValue: CalendarData }, emit?: any) {
  const isCollapsed = ref(false);

  const getDaysInMonth = (cal: any, year: number, monthIdx: number) => CalendarMath.getDaysInMonth(cal, year, monthIdx);

  const wheelHorizontal = ref(
    settingsService.getSettings()?.dropdowns?.wheelOrientation === "horizontal",
  );

  onMounted(() => {
    settingsService.onChange(
      (s: any) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === "horizontal"),
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

  return {
    isCollapsed,
    wheelHorizontal,
    getDaysInMonth,
    moveItem,
    addHoliday
  };
}
