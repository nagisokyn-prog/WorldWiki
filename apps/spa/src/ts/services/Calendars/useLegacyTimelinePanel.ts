import { ref, onMounted, computed } from 'vue';
import { useCalendarStore } from '../../stores/calendar.store';
import type { CalendarRecord } from '../../stores/calendar.store';
import { CalendarMath } from './calendar.math';
import type { CalendarData, CalendarEra, CalendarMonth } from './calendar.types';
import { settingsService } from '@worldwiki/components';
import { getLegacyConvertedDateInfo, getLegacyOptionHelpers } from './useLegacyTimelineHelpers';
import { createInitialTimelineEvents, computeNextRelativeEvent } from './useLegacyTimelineEventOps';

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

  const {
    getEraOptions,
    getMonthOptions,
    getHourOptions,
    getMinuteOptions,
    getDaysInMonth
  } = getLegacyOptionHelpers(getCalendar);

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

  const loadCalendarData = (calObj: CalendarRecord) => {
    const cal = calObj.data;
    if (cal && useCalendarStore().isValidCalendar(cal)) {
      calendar.value = cal;
      calendar.value._id = calObj.id;
      if (cal.эпохи && cal.эпохи.length > 0) eras.value = cal.эпохи;
      if (cal.месяцы && cal.месяцы.length > 0) months.value = cal.месяцы;
      if (cal.настройки_времени) showTimeSettings.value = true;
    }
  };

  const setupDefaultEvents = (defaultCal: CalendarRecord) => {
    const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
    let hasChanges = false;

    if (newEvents.length === 0) {
      const initial = createInitialTimelineEvents(defaultCal.id || 'default', defaultCal.data);
      newEvents.push(...initial);
      expandedIndices.value.add(0);
      hasChanges = true;
    } else {
      newEvents.forEach(event => {
        if (!event.calendar_id) {
          event.calendar_id = defaultCal.id || 'default';
          hasChanges = true;
        }
      });
    }

    if (hasChanges) {
      emit('update:events', newEvents);
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
        setupDefaultEvents(defaultCal);
      }
    } catch (e) {
      console.warn('Could not load calendars, using defaults', e);
      const defaultCal = { id: 'default', is_default: true, data: CalendarMath.getDefaultCalendar() };
      availableCalendars.value = [defaultCal];
      selectedCalendarIds.value = ['default'];
      loadCalendarData(defaultCal);
      setupDefaultEvents(defaultCal);
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
    return getLegacyConvertedDateInfo(event, targetCalId, getCalendar);
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

  const updateEventTime = (idx: number, field: 'hour' | 'minute', val: number) => {
    const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
    if (!newEvents[idx].time) newEvents[idx].time = { hour: 0, minute: 0 };
    newEvents[idx].time![field] = val;
    emit('update:events', newEvents);
    onChange();
  };

  const addEvent = () => {
    const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
    const firstCal = availableCalendars.value[0];
    const initial = createInitialTimelineEvents(firstCal?.id || 'default', firstCal?.data);
    newEvents.push(initial[0]);
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

    const nextEvent = computeNextRelativeEvent(currentEvent, input, cal);
    const newEvents = [...(props.events as TimelineEvent[])];
    newEvents.splice(idx + 1, 0, nextEvent);

    expandedIndices.value.add(idx + 1);
    relativeInput.value[idx] = '';
    emit('update:events', newEvents);
    onChange();
  };

  const getUniversalDateObject = (ev: TimelineEvent) => ({
    calendar_id: ev.calendar_id,
    original_input: {
      era_index: ev.date.era,
      year: ev.date.year,
      month: ev.date.month,
      day: ev.date.day,
      hour: ev.time?.hour ?? 12,
      minute: ev.time?.minute ?? 0
    }
  });

  const updateEventFullDate = (
    idx: number,
    val: {
      calendar_id?: string;
      original_input?: { era_index: number; year: number; month: number; day: number; hour?: number; minute?: number }
    } | null
  ) => {
    if (!val || !val.original_input) return;
    const newEvents = [...(props.events as TimelineEvent[])];
    newEvents[idx] = {
      calendar_id: val.calendar_id,
      date: {
        era: val.original_input.era_index,
        year: val.original_input.year,
        month: val.original_input.month,
        day: val.original_input.day
      },
      time: {
        hour: val.original_input.hour ?? 12,
        minute: val.original_input.minute ?? 0
      },
      description: newEvents[idx].description
    };
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
    onYearInput: (idx: number, e: Event) => updateEventDate(idx, 'year', parseInt((e.target as HTMLInputElement).value) || 1),
    onDayInput: (idx: number, e: Event) => updateEventDate(idx, 'day', parseInt((e.target as HTMLInputElement).value) || 1),
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
