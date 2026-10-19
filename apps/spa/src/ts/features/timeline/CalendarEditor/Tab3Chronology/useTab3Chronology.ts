import { computed } from 'vue';
import type {
  CalendarData,
  CalendarEra,
  CalendarHoliday,
} from '@/services/Calendars/calendar.types';
import type {
  Tab3ChronologyProps,
  Tab3ChronologyEmits,
  CalendarOrigin,
} from './Tab3Chronology.model';

export function useTab3Chronology(
  props: Tab3ChronologyProps,
  emit: Tab3ChronologyEmits
) {
  const eras = computed<CalendarEra[]>(() => {
    return props.calendarData?.эпохи || [];
  });

  const origin = computed<CalendarOrigin>(() => {
    return (
      (props.calendarData?.точка_отсчета as CalendarOrigin) || {
        эпоха: 0,
        год: 1,
        месяц: 0,
        день: 1,
      }
    );
  });

  const holidays = computed<CalendarHoliday[]>(() => {
    return props.calendarData?.праздники || [];
  });

  function updateEras(newEras: CalendarEra[]) {
    emit('update', { эпохи: newEras });
  }

  function updateOrigin(patch: Partial<CalendarOrigin>) {
    emit('update', {
      точка_отсчета: {
        ...origin.value,
        ...patch,
      },
    } as unknown as Partial<CalendarData>);
  }

  function updateHolidays(newHolidays: CalendarHoliday[]) {
    emit('update', { праздники: newHolidays });
  }

  function addEra() {
    const nextIdx = eras.value.length + 1;
    const newEra: CalendarEra = {
      название: `Эпоха ${nextIdx}`,
      год_начала: 1,
      год_конца: 1000,
    };
    updateEras([...eras.value, newEra]);
  }

  function removeEra(idx: number) {
    updateEras(eras.value.filter((_, i) => i !== idx));
  }

  function addHoliday() {
    const nextIdx = holidays.value.length + 1;
    const newHoliday: CalendarHoliday = {
      название: `Праздник ${nextIdx}`,
      дата_начала: { месяц: 1, день: 1 },
    };
    updateHolidays([...holidays.value, newHoliday]);
  }

  function removeHoliday(idx: number) {
    updateHolidays(holidays.value.filter((_, i) => i !== idx));
  }

  return {
    eras,
    origin,
    holidays,
    updateEras,
    updateOrigin,
    updateHolidays,
    addEra,
    removeEra,
    addHoliday,
    removeHoliday,
  };
}
