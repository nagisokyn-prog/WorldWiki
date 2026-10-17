import { ref, onMounted } from "vue";
import { settingsService } from '@worldwiki/components';
import { CalendarMath } from "../../../../services/Calendars/useCalendarEngine";
import type { CalendarData } from "../../../../services/Calendars/calendar.types";

export function useCalendarOrigin(props: { modelValue: CalendarData }, _emit?: (event: string, ...args: unknown[]) => void) {
  const isCollapsed = ref(false);

  const getDaysInMonth = (cal: CalendarData, year: number, monthIdx: number) => CalendarMath.getDaysInMonth(cal, year, monthIdx);

  const wheelHorizontal = ref(
    settingsService.getSettings()?.dropdowns?.wheelOrientation === "horizontal",
  );

  const updateOriginField = (field: string, val: number) => {
    if (props.modelValue.точка_отсчета) {
      (props.modelValue.точка_отсчета as unknown as Record<string, number>)[field] = val;
    }
  };

  onMounted(() => {
    settingsService.onChange(
      (s: AppSettings) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === "horizontal"),
    );
    if (!props.modelValue.точка_отсчета) {
      props.modelValue.точка_отсчета = { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 };
    }
  });

  return {
    isCollapsed,
    wheelHorizontal,
    getDaysInMonth,
    updateOriginField
  };
}
