import { ref, onMounted, computed } from 'vue';
import { useCalendarStore } from '../../stores/calendar.store';
import type { CalendarRecord } from '../../stores/calendar.store';
import { CalendarMath } from './calendar.math';
import type { CalendarData, CalendarEra, CalendarMonth } from './calendar.types';
import { settingsService } from '@worldwiki/components';

export interface TimelineEvent {
  date: {
    era: number;
    year: number;
    month: number;
    day: number;
  };
  time?: {
    hour?: number;
    minute?: number;
  };
  description: string;
  calendar_id?: string;
}

export interface UseLegacyTimelineProps {
  project: string;
  events: TimelineEvent[];
}

export interface UseLegacyTimelineEmits {
  (e: 'update:events', events: TimelineEvent[]): void;
  (e: 'change'): void;
}

export function useLegacyTimelinePanel(props: UseLegacyTimelineProps, emit: UseLegacyTimelineEmits) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');
  const calendar = ref<CalendarData | null>(null);
  const eras = ref<CalendarEra[]>([]);
  const months = ref<CalendarMonth[]>([]);
  const showTimeSettings = ref(false);
  const expandedIndices = ref<Set<number>>(new Set());
  const availableCalendars = ref<CalendarRecord[]>([]);
  const selectedCalendarIds = ref<string[]>([]);
  const relativeInput = ref<Record<number, string>>({});

  const getCalendar = (calId?: string): CalendarData | undefined => {
    const id = calId || availableCalendars.value[0]?.id;
    return availableCalendars.value.find(c => c.id === id)?.data;
  };

  const isExpanded = (idx: number) => expandedIndices.value.has(idx);

  const toggleExpand = (idx: number) => {
    if (expandedIndices.value.has(idx)) {
      expandedIndices.value.delete(idx);
    } else {
      expandedIndices.value.add(idx);
    }
  };

  const calendarOptions = computed(() => availableCalendars.value.map(cal => ({
    value: cal.id,
    label: cal.data?.название || 'Календарь'
  })));

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

  const loadCalendarData = (calObj: CalendarRecord) => {
    const cal = calObj.data;
    if (cal && useCalendarStore().isValidCalendar(cal)) {
      calendar.value = cal;
      calendar.value._id = calObj.id;
      if (cal.эпохи && cal.эпохи.length > 0) eras.value = cal.эпохи;
      if (cal.месяцы && cal.месяцы.length > 0) months.value = cal.месяцы;

      if (cal.настройки_времени) {
        showTimeSettings.value = true;
      }
    }
  };

  onMounted(async () => {
    try {
      const calendarsList = await useCalendarStore().getCalendars(props.project);

      availableCalendars.value = calendarsList.map(c => ({
        id: c.id,
        is_default: c.is_default,
        data: c.data || CalendarMath.getDefaultCalendar()
      }));

      const defaultCal = availableCalendars.value.find(c => c.is_default) || availableCalendars.value[0];
      if (defaultCal) {
        selectedCalendarIds.value = defaultCal.id ? [defaultCal.id] : [];
        loadCalendarData(defaultCal);

        const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
        let hasChanges = false;

        if (newEvents.length === 0) {
          const origin = defaultCal.data?.точка_отсчета || { эпоха: 0, год: 1, месяц: 0, день: 1 };
          newEvents.push({
            date: {
              era: origin.эпоха ?? 0,
              year: origin.год ?? 1,
              month: origin.месяц ?? 0,
              day: origin.день ?? 1
            },
            time: { hour: 12, minute: 0 },
            description: '',
            calendar_id: defaultCal.id
          });
          expandedIndices.value.add(0);
          hasChanges = true;
        } else {
          newEvents.forEach(event => {
            if (!event.calendar_id) {
              event.calendar_id = defaultCal.id;
              hasChanges = true;
            }
          });
        }

        if (hasChanges) {
          emit('update:events', newEvents);
        }
      }
    } catch (e) {
      console.warn('Could not load calendars, using defaults', e);
      const defaultCal = {
        id: 'default',
        is_default: true,
        data: CalendarMath.getDefaultCalendar()
      };
      availableCalendars.value = [defaultCal];
      selectedCalendarIds.value = ['default'];
      loadCalendarData(defaultCal);

      const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
      let hasChanges = false;

      if (newEvents.length === 0) {
        const origin = defaultCal.data.точка_отсчета || { эпоха: 0, год: 1, месяц: 0, день: 1 };
        newEvents.push({
          date: {
            era: origin.эпоха ?? 0,
            year: origin.год ?? 1,
            month: origin.месяц ?? 0,
            day: origin.день ?? 1
          },
          time: { hour: 12, minute: 0 },
          description: '',
          calendar_id: 'default'
        });
        expandedIndices.value.add(0);
        hasChanges = true;
      } else {
        newEvents.forEach(event => {
          if (!event.calendar_id) {
            event.calendar_id = 'default';
            hasChanges = true;
          }
        });
      }

      if (hasChanges) {
        emit('update:events', newEvents);
      }
    }

    settingsService.onChange(s => {
      wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal';
    });
  });

  const onChange = () => {
    emit('change');
  };

  const toggleCalendarSelection = (calId: string) => {
    if (selectedCalendarIds.value.includes(calId)) {
      selectedCalendarIds.value = selectedCalendarIds.value.filter(id => id !== calId);
    } else {
      selectedCalendarIds.value.push(calId);
    }
  };

  const getConvertedDateInfo = (event: TimelineEvent, targetCalId: string) => {
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

    const absMin = CalendarMath.getAbsoluteMinute(inputObj, sourceCal);
    const localDate = CalendarMath.getDateFromAbsolute(absMin, targetCal);

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

  const getDaysInMonth = (calId: string | undefined, monthIdx: number): number => {
    const cal = getCalendar(calId);
    if (!cal) return 30;
    return cal.месяцы?.[monthIdx]?.дней || 30;
  };

  const updateEventDate = (idx: number, field: string, value: number) => {
    const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
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
    const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
    if (!newEvents[idx].time) newEvents[idx].time = { hour: 0, minute: 0 };
    if (field === 'hour') newEvents[idx].time!.hour = value;
    if (field === 'minute') newEvents[idx].time!.minute = value;
    emit('update:events', newEvents);
    onChange();
  };

  const addEvent = () => {
    const newEvents = [...(props.events as TimelineEvent[])];
    const nativeCalId = selectedCalendarIds.value[0] || availableCalendars.value[0]?.id;
    const cal = getCalendar(nativeCalId);

    const origin = cal?.точка_отсчета || { эпоха: 0, год: 1, месяц: 0, день: 1 };

    let defaultDate = { era: origin.эпоха ?? 0, year: origin.год ?? 1, month: origin.месяц ?? 0, day: origin.день ?? 1 };
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
    const newEvents = [...(props.events as TimelineEvent[])];
    newEvents.splice(idx, 1);
    emit('update:events', newEvents);
    onChange();
  };

  const createNextEvent = (idx: number) => {
    const currentEvent = props.events[idx];
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

    const newEvents = [...(props.events as TimelineEvent[])];
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
      original_input?: { era_index: number; year: number; month: number; day: number; hour?: number; minute?: number }
    } | null
  ) => {
    if (!val || !val.original_input) return;
    
    const newEvents = [...(props.events as TimelineEvent[])];
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
    wheelHorizontal,
    calendarOptions,
    availableCalendars,
    selectedCalendarIds,
    toggleCalendarSelection,
    isExpanded,
    toggleExpand,
    removeEvent,
    getConvertedDateInfo,
    getEraOptions,
    getMonthOptions,
    getHourOptions,
    getMinuteOptions,
    updateEventDate,
    onYearInput,
    onDayInput,
    getDaysInMonth,
    updateEventTime,
    onChange,
    relativeInput,
    createNextEvent,
    addEvent,
    getUniversalDateObject,
    updateEventFullDate
  };
}
