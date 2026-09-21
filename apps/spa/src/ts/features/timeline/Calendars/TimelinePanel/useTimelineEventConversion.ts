import { computed, type Ref } from 'vue';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';
import type { CalendarData, CalendarEra, CalendarMonth } from '../../../../services/Calendars/calendar.types';
import type { CalendarRecord } from '../../../../stores/calendar.store';
import type { TimelineEvent } from './useTimelinePanel';

export interface ConvertedDateInfo {
  seasonName: string;
  seasonColor: string;
  timeOfDayName: string;
  timeOfDayColor: string;
  dateStr: string;
  calName: string;
  isNative: boolean;
}

export function useTimelineEventConversion(
  events: Ref<TimelineEvent[]>,
  availableCalendars: Ref<CalendarRecord[]>,
  selectedCalendarIds: Ref<string[]>
) {
  const getCalendar = (calId?: string): CalendarData | undefined => {
    const id = calId || availableCalendars.value[0]?.id;
    return availableCalendars.value.find(c => c.id === id)?.data;
  };

  const masterCalendar = computed(() => {
    return availableCalendars.value.find(
      c => c.is_master || (c.data && (c.data as Record<string, unknown>).is_master)
    )?.data || null;
  });

  const getEraOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    if (!cal || !cal.эпохи) return [];
    return cal.эпохи.map((era: CalendarEra, idx: number) => ({
      value: idx,
      label: era.название || (era as unknown as { name?: string }).name || `Эра ${idx + 1}`
    }));
  };

  const getMonthOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    if (!cal || !cal.месяцы) return [];
    return cal.месяцы.map((month: CalendarMonth, idx: number) => ({
      value: idx,
      label: month.название || (month as unknown as { name?: string }).name || `Месяц ${idx + 1}`
    }));
  };

  const getHourOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    const hoursInDay = cal?.настройки_времени?.часов_в_сутках || 24;
    return Array.from({ length: hoursInDay }, (_, i) => ({
      value: i,
      label: `${String(i).padStart(2, '0')}`
    }));
  };

  const getMinuteOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    const minsInHour = cal?.настройки_времени?.минут_в_часе || 60;
    return Array.from({ length: minsInHour }, (_, i) => ({
      value: i,
      label: `${String(i).padStart(2, '0')}`
    }));
  };

  const getDisplayCalendarIds = (event: TimelineEvent): string[] => {
    const nativeId = event.calendar_id || availableCalendars.value[0]?.id;
    const list: string[] = [];
    if (nativeId) {
      list.push(nativeId);
    }
    for (const selId of selectedCalendarIds.value) {
      if (selId && selId !== nativeId && !list.includes(selId)) {
        list.push(selId);
      }
    }
    return list;
  };

  const convertedDateInfoMap = computed(() => {
    const map = new Map<string, ConvertedDateInfo>();

    const seasonColors: Record<string, string> = {
      'Весна': 'rgba(34, 197, 94, 0.3)',
      'Лето': 'rgba(245, 158, 11, 0.3)',
      'Осень': 'rgba(239, 68, 68, 0.3)',
      'Зима': 'rgba(59, 130, 246, 0.3)',
    };

    events.value.forEach((event, evIdx) => {
      const sourceCal = getCalendar(event.calendar_id);
      if (!sourceCal) return;

      const displayCalIds = getDisplayCalendarIds(event);

      displayCalIds.forEach(targetCalId => {
        const targetCal = getCalendar(targetCalId);
        if (!targetCal) return;

        const inputObj = {
          era_index: Number(event.date?.era) || 0,
          year: Number(event.date?.year) || 1,
          month: Number(event.date?.month) || 0,
          day: Number(event.date?.day) || 1,
          hour: Number(event.time?.hour ?? 12),
          minute: Number(event.time?.minute ?? 0)
        };

        const localDate = CalendarMath.convertDateBetweenCalendars(
          inputObj,
          sourceCal,
          targetCal,
          masterCalendar.value
        );

        const season = CalendarMath.getSeasonForDate(targetCal, localDate.year, localDate.month);
        const seasonObj = targetCal.сезоны?.find(s => s.название === season);
        const seasonColor = seasonObj?.цвет || seasonColors[season] || 'rgba(139, 92, 246, 0.2)';

        const era = targetCal.эпохи?.[localDate.era_index];
        const month = targetCal.месяцы?.[localDate.month];
        let dateStr = `${localDate.year} год, ${month?.название || 'Месяц'} ${localDate.day}`;
        if (era) dateStr += ` (${era.название})`;

        if (event.time?.hour !== undefined) {
          dateStr += `, ${String(localDate.hour || 0).padStart(2, '0')}:${String(localDate.minute || 0).padStart(2, '0')}`;
        }

        const hour = localDate.hour || 0;
        let timeOfDayName = '🌙 Ночь';
        let timeOfDayColor = 'rgba(59, 130, 246, 0.3)';

        if (hour >= 5 && hour < 12) { timeOfDayName = '🌅 Утро'; timeOfDayColor = 'rgba(249, 115, 22, 0.3)'; }
        else if (hour >= 12 && hour < 17) { timeOfDayName = '☀️ День'; timeOfDayColor = 'rgba(251, 191, 36, 0.3)'; }
        else if (hour >= 17 && hour < 21) { timeOfDayName = '🌆 Вечер'; timeOfDayColor = 'rgba(249, 115, 22, 0.3)'; }

        map.set(`${evIdx}:${targetCalId}`, {
          seasonName: season || 'Без сезона',
          seasonColor,
          timeOfDayName,
          timeOfDayColor,
          dateStr,
          calName: targetCal.название || 'Календарь',
          isNative: event.calendar_id === targetCalId
        });
      });
    });

    return map;
  });

  const getConvertedDateInfo = (event: TimelineEvent, targetCalId: string, idx?: number): ConvertedDateInfo | null => {
    if (idx !== undefined) {
      const cached = convertedDateInfoMap.value.get(`${idx}:${targetCalId}`);
      if (cached) return cached;
    }
    const sourceCal = getCalendar(event.calendar_id);
    const targetCal = getCalendar(targetCalId);

    if (!sourceCal || !targetCal) return null;

    const inputObj = {
      era_index: event.date.era,
      year: event.date.year,
      month: event.date.month,
      day: event.date.day,
      hour: event.time?.hour || 0,
      minute: event.time?.minute || 0
    };

    const localDate = CalendarMath.convertDateBetweenCalendars(
      inputObj,
      sourceCal,
      targetCal,
      masterCalendar.value
    );

    const season = CalendarMath.getSeasonForDate(targetCal, localDate.year, localDate.month);
    const seasonColors: Record<string, string> = {
      'Весна': 'rgba(34, 197, 94, 0.3)',
      'Лето': 'rgba(245, 158, 11, 0.3)',
      'Осень': 'rgba(239, 68, 68, 0.3)',
      'Зима': 'rgba(59, 130, 246, 0.3)',
    };
    const seasonColor = seasonColors[season] || 'rgba(139, 92, 246, 0.2)';

    const era = targetCal.эпохи?.[localDate.era_index];
    const month = targetCal.месяцы?.[localDate.month];
    let dateStr = `${localDate.year} год, ${month?.название || 'Месяц'} ${localDate.day}`;
    if (era) dateStr += ` (${era.название})`;

    if (event.time?.hour !== undefined) {
      dateStr += `, ${String(localDate.hour || 0).padStart(2, '0')}:${String(localDate.minute || 0).padStart(2, '0')}`;
    }

    const hour = localDate.hour || 0;
    let timeOfDayName = '🌙 Ночь';
    let timeOfDayColor = 'rgba(59, 130, 246, 0.3)';

    if (hour >= 5 && hour < 12) { timeOfDayName = '🌅 Утро'; timeOfDayColor = 'rgba(249, 115, 22, 0.3)'; }
    else if (hour >= 12 && hour < 17) { timeOfDayName = '☀️ День'; timeOfDayColor = 'rgba(251, 191, 36, 0.3)'; }
    else if (hour >= 17 && hour < 21) { timeOfDayName = '🌆 Вечер'; timeOfDayColor = 'rgba(249, 115, 22, 0.3)'; }

    return {
      seasonName: season || 'Без сезона',
      seasonColor,
      timeOfDayName,
      timeOfDayColor,
      dateStr,
      calName: targetCal.название || 'Календарь',
      isNative: event.calendar_id === targetCalId
    };
  };

  return {
    getCalendar,
    masterCalendar,
    getEraOptions,
    getMonthOptions,
    getHourOptions,
    getMinuteOptions,
    getDisplayCalendarIds,
    getConvertedDateInfo,
    convertedDateInfoMap
  };
}
