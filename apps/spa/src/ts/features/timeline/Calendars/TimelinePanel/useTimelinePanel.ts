import { ref, onMounted, computed, toRef } from 'vue';
import { useCalendarStore } from '../../../../stores/calendar.store';
import type { CalendarRecord } from '../../../../stores/calendar.store';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';
import type { CalendarData, CalendarEra, CalendarMonth } from '../../../../services/Calendars/calendar.types';
import { settingsService, type AppSettings } from '@worldwiki/components';
import { useTimelineEventConversion } from './useTimelineEventConversion';
import { useTimelineEventOps } from './useTimelineEventOps';

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

export function useTimelinePanel(
  props: { project: string; events: TimelineEvent[] },
  emit: (event: string, ...args: unknown[]) => void
) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');
  const calendar = ref<CalendarData | null>(null);
  const eras = ref<CalendarEra[]>([]);
  const months = ref<CalendarMonth[]>([]);
  const showTimeSettings = ref(false);
  const expandedIndices = ref<Set<number>>(new Set());
  const availableCalendars = ref<CalendarRecord[]>([]);
  const selectedCalendarIds = ref<string[]>([]);

  const eventsRef = toRef(props, 'events');

  const {
    getCalendar,
    getEraOptions,
    getMonthOptions,
    getHourOptions,
    getMinuteOptions,
    getConvertedDateInfo
  } = useTimelineEventConversion(eventsRef, availableCalendars, selectedCalendarIds);

  const {
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
  } = useTimelineEventOps(
    eventsRef,
    availableCalendars,
    selectedCalendarIds,
    expandedIndices,
    getCalendar,
    emit
  );

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

    settingsService.onChange((s: AppSettings) => {
      wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal';
    });
  });

  const toggleCalendarSelection = (calId: string) => {
    if (selectedCalendarIds.value.includes(calId)) {
      selectedCalendarIds.value = selectedCalendarIds.value.filter(id => id !== calId);
    } else {
      selectedCalendarIds.value.push(calId);
    }
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
