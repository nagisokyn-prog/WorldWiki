import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { CalendarMath } from '../../../../services/Calendars/useCalendarEngine';
import type { CalendarData, CalendarDate, MoonPhaseResult } from '../../../../services/Calendars/calendar.types';

export function useTimeAtlasMatrix(
  getCalendarById: (id: string) => CalendarData | null,
  masterCalendar: ComputedRef<CalendarData | null>,
  currentWorldMinute: Ref<number>,
  getDateMeta: (cal: CalendarData, date: CalendarDate['original_input']) => {
    season: string;
    holiday: string | null;
    moons: MoonPhaseResult[];
  }
) {
  const matrixBaseCalId = ref<string>('');
  const matrixCompareCalId = ref<string>('');
  const matrixEra = ref(0);
  const matrixYear = ref(1);
  const matrixMonth = ref(0);

  const matrixBaseCal = computed(() => getCalendarById(matrixBaseCalId.value));
  const matrixCompareCal = computed(() => getCalendarById(matrixCompareCalId.value));

  const matrixDaysCount = computed(() => {
    if (!matrixBaseCal.value) return 30;
    return CalendarMath.getDaysInMonth(matrixBaseCal.value, matrixYear.value, matrixMonth.value);
  });

  const matrixGridDays = computed(() => {
    const base = matrixBaseCal.value;
    const comp = matrixCompareCal.value;
    if (!base) return [];

    const days = [];
    for (let d = 1; d <= matrixDaysCount.value; d++) {
      const baseInput: CalendarDate['original_input'] = {
        era_index: matrixEra.value,
        year: matrixYear.value,
        month: matrixMonth.value,
        day: d,
        hour: 12,
        minute: 0
      };

      const baseMin = CalendarMath.localDateToMasterMinute(baseInput, base, masterCalendar.value);
      const baseMeta = getDateMeta(base, baseInput);

      let compDateStr = '';
      let compHoliday: string | null = null;

      if (comp) {
        const compDate = CalendarMath.masterMinuteToLocalDate(baseMin, comp, masterCalendar.value, 0);
        const compMeta = getDateMeta(comp, compDate);
        compHoliday = compMeta.holiday;
        const compMonthName = comp.месяцы?.[compDate.month]?.название?.slice(0, 3) || `${compDate.month + 1}`;
        compDateStr = `${compDate.day} ${compMonthName}`;
      }

      days.push({
        day: d,
        baseInput,
        baseMin,
        baseMeta,
        compDateStr,
        compHoliday,
        isCurrent: Math.floor(baseMin / 1440) === Math.floor(currentWorldMinute.value / 1440)
      });
    }
    return days;
  });

  const selectMatrixDay = (baseMin: number) => {
    currentWorldMinute.value = baseMin;
  };

  const prevMatrixMonth = () => {
    if (!matrixBaseCal.value) return;
    if (matrixMonth.value > 0) {
      matrixMonth.value--;
    } else {
      matrixMonth.value = (matrixBaseCal.value.месяцы?.length || 1) - 1;
      matrixYear.value--;
    }
  };

  const nextMatrixMonth = () => {
    if (!matrixBaseCal.value) return;
    if (matrixMonth.value < (matrixBaseCal.value.месяцы?.length || 1) - 1) {
      matrixMonth.value++;
    } else {
      matrixMonth.value = 0;
      matrixYear.value++;
    }
  };

  return {
    matrixBaseCalId,
    matrixCompareCalId,
    matrixEra,
    matrixYear,
    matrixMonth,
    matrixBaseCal,
    matrixCompareCal,
    matrixDaysCount,
    matrixGridDays,
    selectMatrixDay,
    prevMatrixMonth,
    nextMatrixMonth
  };
}
