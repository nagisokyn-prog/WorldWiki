import { computed } from 'vue';
import type { CalendarRecord } from '../../../../../stores/calendar.store';
import type { CalendarData, CalendarDate, MoonPhaseResult } from '../../../../../services/Calendars/calendar.types';

export interface TimeAtlasBridgeTabProps {
  masterCalendarRecord: CalendarRecord | null;
  localCalendarRecords: CalendarRecord[];
  getLocalDateForCal: (cal: CalendarData) => CalendarDate['original_input'];
  updateFromLocalDate: (cal: CalendarData, localDate: CalendarDate['original_input']) => void;
  getDateMeta: (cal: CalendarData, date: CalendarDate['original_input']) => {
    season: string;
    holiday: string | null;
    moons: MoonPhaseResult[];
  };
}

export function useTimeAtlasBridgeTab(props: TimeAtlasBridgeTabProps) {
  const masterCalData = computed<CalendarData | null>(() => {
    return (props.masterCalendarRecord?.data as CalendarData) || null;
  });

  const localCalsWithData = computed<Array<{ id: string; name: string; data: CalendarData }>>(() => {
    return props.localCalendarRecords
      .filter(c => !!c.data)
      .map(c => ({
        id: c.id || '',
        name: (c.data as CalendarData).название || 'Календарь',
        data: c.data as CalendarData
      }));
  });

  const onEraChange = (cal: CalendarData, e: Event) => {
    const select = e.target as HTMLSelectElement;
    const eraIdx = Number(select.value);
    const current = props.getLocalDateForCal(cal);
    const era = cal.эпохи?.[eraIdx];
    let year = current.year;
    if (era) {
      if (year < era.год_начала) year = era.год_начала;
      if (year > era.год_конца) year = era.год_конца;
    }
    props.updateFromLocalDate(cal, { ...current, era_index: eraIdx, year });
  };

  const onYearChange = (cal: CalendarData, e: Event) => {
    const input = e.target as HTMLInputElement;
    const current = props.getLocalDateForCal(cal);
    props.updateFromLocalDate(cal, { ...current, year: Number(input.value) });
  };

  const onMonthChange = (cal: CalendarData, e: Event) => {
    const select = e.target as HTMLSelectElement;
    const current = props.getLocalDateForCal(cal);
    props.updateFromLocalDate(cal, { ...current, month: Number(select.value) });
  };

  const onDayChange = (cal: CalendarData, e: Event) => {
    const input = e.target as HTMLInputElement;
    const current = props.getLocalDateForCal(cal);
    props.updateFromLocalDate(cal, { ...current, day: Number(input.value) });
  };

  return {
    masterCalData,
    localCalsWithData,
    onEraChange,
    onYearChange,
    onMonthChange,
    onDayChange
  };
}
