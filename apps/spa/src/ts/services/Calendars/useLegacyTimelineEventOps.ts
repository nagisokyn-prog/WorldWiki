import { CalendarMath } from './calendar.math';
import type { CalendarData } from './calendar.types';
import type { TimelineEvent } from './useLegacyTimelinePanel';

export function createInitialTimelineEvents(defaultCalId: string, defaultCalData?: CalendarData): TimelineEvent[] {
  const origin = defaultCalData?.точка_отсчета || { эпоха: 0, год: 1, месяц: 0, день: 1 };
  return [{
    date: {
      era: origin.эпоха ?? 0,
      year: origin.год ?? 1,
      month: origin.месяц ?? 0,
      day: origin.день ?? 1
    },
    time: { hour: 12, minute: 0 },
    description: '',
    calendar_id: defaultCalId
  }];
}

export function computeNextRelativeEvent(
  currentEvent: TimelineEvent,
  input: string,
  cal: CalendarData
): TimelineEvent {
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

  return {
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
  };
}
