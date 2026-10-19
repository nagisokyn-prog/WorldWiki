import { ref, type Ref } from 'vue';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { TimelineEvent } from './useTimelinePanel';

export function useTimelineEventOps(
  events: Ref<TimelineEvent[]>,
  availableCalendars: Ref<CalendarRecord[]>,
  selectedCalendarIds: Ref<string[]>,
  expandedIndices: Ref<Set<number>>,
  getCalendar: (calId?: string) => CalendarData | undefined,
  emit: (event: string, ...args: unknown[]) => void
) {
  const relativeInput = ref<Record<number, string>>({});

  const onChange = () => {
    emit('change');
  };

  const getDaysInMonth = (calId: string | undefined, monthIdx: number): number => {
    const cal = getCalendar(calId);
    if (!cal) return 30;
    return cal.месяцы?.[monthIdx]?.дней || 30;
  };

  const updateEventDate = (idx: number, field: string, value: number) => {
    const newEvents = JSON.parse(JSON.stringify(events.value)) as TimelineEvent[];
    if (field === 'era') newEvents[idx].date.era = value;
    if (field === 'year') newEvents[idx].date.year = value;
    if (field === 'month') newEvents[idx].date.month = value;
    if (field === 'day') {
      const maxDay = getDaysInMonth(newEvents[idx].calendar_id, newEvents[idx].date.month);
      newEvents[idx].date.day = Math.min(value, maxDay);
    }
    emit('update:events', newEvents);
    onChange();
  };

  const onYearInput = (idx: number, e: Event) => {
    const el = e.target as HTMLInputElement;
    updateEventDate(idx, 'year', parseInt(el.value) || 1);
  };

  const onDayInput = (idx: number, e: Event) => {
    const el = e.target as HTMLInputElement;
    updateEventDate(idx, 'day', parseInt(el.value) || 1);
  };

  const updateEventTime = (idx: number, field: string, value: number) => {
    const newEvents = JSON.parse(JSON.stringify(events.value)) as TimelineEvent[];
    if (!newEvents[idx].time) newEvents[idx].time = { hour: 0, minute: 0 };
    if (field === 'hour') newEvents[idx].time!.hour = value;
    if (field === 'minute') newEvents[idx].time!.minute = value;
    emit('update:events', newEvents);
    onChange();
  };

  const addEvent = () => {
    const newEvents = [...events.value];
    const nativeCalId = selectedCalendarIds.value[0] || availableCalendars.value[0]?.id;
    const cal = getCalendar(nativeCalId);

    const origin = cal?.точка_отсчета || { эпоха: 0, год: 1, месяц: 0, день: 1 };

    let defaultDate = {
      era: origin.эпоха ?? 0,
      year: origin.год ?? 1,
      month: origin.месяц ?? 0,
      day: origin.день ?? 1
    };
    let defaultTime = { hour: 12, minute: 0 };
    let calendar_id = nativeCalId;

    if (newEvents.length > 0) {
      const last = newEvents[newEvents.length - 1];
      defaultDate = { ...last.date };
      if (last.time) defaultTime = { hour: last.time.hour ?? 12, minute: last.time.minute ?? 0 };
      calendar_id = last.calendar_id || nativeCalId;
    }

    newEvents.push({
      date: defaultDate,
      time: defaultTime,
      description: '',
      calendar_id
    });
    expandedIndices.value.add(newEvents.length - 1);
    emit('update:events', newEvents);
    onChange();
  };

  const removeEvent = (idx: number) => {
    const newEvents = [...events.value];
    newEvents.splice(idx, 1);
    emit('update:events', newEvents);
    onChange();
  };

  const createNextEvent = (idx: number) => {
    const currentEvent = events.value[idx];
    const input = relativeInput.value[idx];
    const cal = getCalendar(currentEvent.calendar_id);
    if (!input || !cal) return;

    const inputObj = {
      era_index: currentEvent.date.era,
      year: currentEvent.date.year,
      month: currentEvent.date.month,
      day: currentEvent.date.day,
      hour: currentEvent.time?.hour || 0,
      minute: currentEvent.time?.minute || 0
    };

    const absMins = CalendarMath.getAbsoluteMinute(inputObj, cal);
    const delta = CalendarMath.parseDurationString(input, cal);
    const nextDateObj = CalendarMath.getDateFromAbsolute(absMins + delta, cal, currentEvent.date.era);

    const newEvents = [...events.value];
    newEvents.splice(idx + 1, 0, {
      date: {
        era: nextDateObj.era_index,
        year: nextDateObj.year,
        month: nextDateObj.month,
        day: nextDateObj.day
      },
      time: {
        hour: nextDateObj.hour,
        minute: nextDateObj.minute
      },
      description: '',
      calendar_id: currentEvent.calendar_id
    });

    expandedIndices.value.add(idx + 1);
    relativeInput.value[idx] = '';
    emit('update:events', newEvents);
    onChange();
  };

  const getUniversalDateObject = (ev: TimelineEvent) => {
    return {
      calendar_id: ev.calendar_id,
      original_input: {
        era_index: ev.date.era,
        year: ev.date.year,
        month: ev.date.month,
        day: ev.date.day,
        hour: ev.time?.hour ?? 12,
        minute: ev.time?.minute ?? 0
      }
    };
  };

  const updateEventFullDate = (
    idx: number,
    val: {
      calendar_id?: string;
      original_input?: {
        era_index: number;
        year: number;
        month: number;
        day: number;
        hour?: number;
        minute?: number;
      };
    } | null
  ) => {
    if (!val || !val.original_input) return;

    const newEvents = [...events.value];
    const ev = { ...newEvents[idx] };

    ev.calendar_id = val.calendar_id;
    ev.date = {
      era: val.original_input.era_index,
      year: val.original_input.year,
      month: val.original_input.month,
      day: val.original_input.day
    };

    ev.time = {
      hour: val.original_input.hour ?? 12,
      minute: val.original_input.minute ?? 0
    };

    newEvents[idx] = ev;
    emit('update:events', newEvents);
    onChange();
  };

  return {
    relativeInput,
    onChange,
    getDaysInMonth,
    updateEventDate,
    onYearInput,
    onDayInput,
    updateEventTime,
    addEvent,
    removeEvent,
    createNextEvent,
    getUniversalDateObject,
    updateEventFullDate
  };
}
