import { ref, onMounted } from "vue";
import { settingsService } from '@worldwiki/components';
import { CalendarMath } from "../../../../services/Calendars/calendar.math";
import type { CalendarData } from "../../../../services/Calendars/calendar.types";

export function useCalendarOrigin(props: { modelValue: CalendarData }, emit?: any) {
  const isCollapsed = ref(false);

  const getDaysInMonth = (cal: any, year: number, monthIdx: number) => CalendarMath.getDaysInMonth(cal, year, monthIdx);

  const wheelHorizontal = ref(
    settingsService.getSettings()?.dropdowns?.wheelOrientation === "horizontal",
  );

  onMounted(() => {
    settingsService.onChange(
      (s: any) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === "horizontal"),
    );
    if (!props.modelValue.точка_отсчета) {
      props.modelValue.точка_отсчета = { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 };
    }
  });

  return {
    isCollapsed,
    wheelHorizontal,
    getDaysInMonth
  };
}
