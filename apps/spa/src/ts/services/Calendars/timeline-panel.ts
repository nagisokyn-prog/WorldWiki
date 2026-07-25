import { defineComponent, ref, onMounted, computed } from 'vue';
import type { PropType } from 'vue';
import { calendarService } from '../calendar.service';
import { CalendarMath } from './calendar.math';

import { XboxWheel, settingsService } from '@worldwiki/components';
import UniversalDatePicker from '../../features/timeline/UniversalDatePicker/UniversalDatePicker.vue';

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

export default defineComponent({
  name: 'TimelinePanel',
  components: {
    XboxWheel,
    UniversalDatePicker
  },
  props: {
    project: { type: String, required: true },
    events: { type: Array as PropType<TimelineEvent[]>, required: true }
  },
  emits: ['update:events', 'change'],
  setup(props, { emit }) {
    const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');
    const calendar = ref<any>(null);
    const eras = ref<any[]>([]);
    const months = ref<any[]>([]);
    const showTimeSettings = ref(false); // Can be evaluated per event later if needed
    const expandedIndices = ref<Set<number>>(new Set());
    const availableCalendars = ref<any[]>([]);
    const selectedCalendarIds = ref<string[]>([]);
    const relativeInput = ref<Record<number, string>>({});

    const getCalendar = (calId?: string) => {
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
      label: cal.data.название || 'Календарь'
    })));

    const getEraOptions = (calId?: string) => {
      const cal = getCalendar(calId);
      if (!cal || !cal.эпохи) return [];
      return cal.эпохи.map((era: any, idx: number) => ({
        value: idx,
        label: era.название || era.name || `Эра ${idx + 1}`
      }));
    };

    const getMonthOptions = (calId?: string) => {
      const cal = getCalendar(calId);
      if (!cal || !cal.месяцы) return [];
      return cal.месяцы.map((month: any, idx: number) => ({
        value: idx,
        label: month.название || month.name || `Месяц ${idx + 1}`
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

    const loadCalendarData = (calObj: any) => {
      const cal = calObj.data;
      if (cal && calendarService.isValidCalendar(cal)) {
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
        console.log('[Timeline] Loading calendars for project:', props.project);
        const calendarsList = await calendarService.getCalendars(props.project);
        console.log('[Timeline] Raw calendars from DB:', calendarsList);

        availableCalendars.value = calendarsList.map(c => ({
          id: c.id,
          is_default: c.is_default,
          data: c.data || CalendarMath.getDefaultCalendar()
        }));
        console.log('[Timeline] Processed availableCalendars:', availableCalendars.value);

        const defaultCal = availableCalendars.value.find(c => c.is_default) || availableCalendars.value[0];
        console.log('[Timeline] Selected default calendar:', defaultCal);
        if (defaultCal) {
          selectedCalendarIds.value = [defaultCal.id];
          loadCalendarData(defaultCal);

          const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
          console.log('[Timeline] Current events in chapter:', newEvents);
          let hasChanges = false;

          if (newEvents.length === 0) {
            const origin = defaultCal.data.точка_отсчета || { эпоха: 0, год: 1, месяц: 0, день: 1 };
            console.log('[Timeline] Auto-creating first event with origin:', origin);
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

      settingsService.onChange(s => wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal');
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
      let dateStr = `${localDate.year} год, ${month?.название || month?.name || 'Месяц'} ${localDate.day}`;
      if (era) dateStr += ` (${era.название || era.name})`;

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
      console.log('[Timeline] addEvent clicked');
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

    const updateEventFullDate = (idx: number, val: any) => {
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
});
