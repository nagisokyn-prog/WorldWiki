import { defineComponent, ref, onMounted, computed, PropType } from 'vue';
import { calendarService } from '../calendar.service';
import { CalendarMath } from './calendar.math';
import XboxWheel from '../../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue';
import { settingsService } from '../../../../tauri-surreal-kit/frontend/src/js/services/settings.service';

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
    XboxWheel
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
    const showTimeSettings = ref(false);
    const expandedIndices = ref<Set<number>>(new Set());
    const availableCalendars = ref<any[]>([]);
    const selectedCalendarId = ref<string | null>(null);
    const relativeInput = ref<Record<number, string>>({});

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

    const eraOptions = computed(() => eras.value.map((era, idx) => ({
      value: idx,
      label: era.название || era.name || `Эра ${idx + 1}`
    })));

    const monthOptions = computed(() => months.value.map((month, idx) => ({
      value: idx,
      label: month.название || month.name || `Месяц ${idx + 1}`
    })));

    const hourOptions = computed(() => {
      const cal = calendar.value;
      const hoursInDay = cal?.настройки_времени?.часов_в_сутках || 24;
      return Array.from({ length: hoursInDay }, (_, i) => ({
        value: i,
        label: `${String(i).padStart(2, '0')}`
      }));
    });

    const minuteOptions = computed(() => {
      const cal = calendar.value;
      const minsInHour = cal?.настройки_времени?.минут_в_часе || 60;
      return Array.from({ length: minsInHour }, (_, i) => ({
        value: i,
        label: `${String(i).padStart(2, '0')}`
      }));
    });

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
        const calendarsList = await calendarService.getCalendars(props.project);
        availableCalendars.value = calendarsList.map(c => ({
          id: c.id,
          is_default: c.is_default,
          data: c.data || CalendarMath.getDefaultCalendar()
        }));

        const defaultCal = availableCalendars.value.find(c => c.is_default) || availableCalendars.value[0];
        if (defaultCal) {
          selectedCalendarId.value = defaultCal.id;
          loadCalendarData(defaultCal);

          const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
          let hasChanges = false;

          if (newEvents.length === 0) {
            const origin = defaultCal.data.точка_отсчета || { год: 1, месяц: 0, день: 1 };
            newEvents.push({
              date: {
                era: 0,
                year: origin.год || 1,
                month: origin.месяц || 0,
                day: origin.день || 1
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
        selectedCalendarId.value = 'default';
        loadCalendarData(defaultCal);

        const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
        let hasChanges = false;

        if (newEvents.length === 0) {
          const origin = defaultCal.data.точка_отсчета || { год: 1, месяц: 0, день: 1 };
          newEvents.push({
            date: {
              era: 0,
              year: origin.год || 1,
              month: origin.месяц || 0,
              day: origin.день || 1
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

    const onCalendarChange = () => {
      const selected = availableCalendars.value.find(c => c.id === selectedCalendarId.value);
      if (selected) {
        loadCalendarData(selected);

        const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
        newEvents.forEach(event => {
          event.calendar_id = selectedCalendarId.value || undefined;
        });
        emit('update:events', newEvents);
        onChange();
      }
    };

    const getSeasonColor = (event: TimelineEvent): string => {
      if (!calendar.value) return 'rgba(139, 92, 246, 0.2)';
      const season = CalendarMath.getSeasonForDate(calendar.value, event.date.year, event.date.month);
      const seasonColors: Record<string, string> = {
        'Весна': 'rgba(34, 197, 94, 0.3)',
        'Лето': 'rgba(245, 158, 11, 0.3)',
        'Осень': 'rgba(239, 68, 68, 0.3)',
        'Зима': 'rgba(59, 130, 246, 0.3)',
      };
      return seasonColors[season] || 'rgba(139, 92, 246, 0.2)';
    };

    const getSeasonName = (event: TimelineEvent): string => {
      if (!calendar.value) return 'Без сезона';
      return CalendarMath.getSeasonForDate(calendar.value, event.date.year, event.date.month);
    };

    const getTimeOfDayName = (event: TimelineEvent): string => {
      const hour = event.time?.hour || 12;
      if (hour >= 5 && hour < 12) return '🌅 Утро';
      if (hour >= 12 && hour < 17) return '☀️ День';
      if (hour >= 17 && hour < 21) return '🌆 Вечер';
      return '🌙 Ночь';
    };

    const getTimeOfDayColor = (event: TimelineEvent): string => {
      const hour = event.time?.hour || 12;
      if (hour >= 5 && hour < 12) return 'rgba(249, 115, 22, 0.3)';
      if (hour >= 12 && hour < 17) return 'rgba(251, 191, 36, 0.3)';
      if (hour >= 17 && hour < 21) return 'rgba(249, 115, 22, 0.3)';
      return 'rgba(59, 130, 246, 0.3)';
    };

    const formatEventDate = (event: TimelineEvent): string => {
      if (!calendar.value) return '';
      const era = eras.value[event.date.era];
      const month = months.value[event.date.month];
      let dateStr = `${event.date.year} год, ${month?.название || month?.name || 'Месяц'} ${event.date.day}`;
      if (era) dateStr += ` (${era.название || era.name})`;
      if (event.time?.hour !== undefined) {
        dateStr += `, ${String(event.time.hour).padStart(2, '0')}:${String(event.time.minute || 0).padStart(2, '0')}`;
      }
      return dateStr;
    };

    const getDaysInMonth = (monthIdx: number): number => {
      if (!calendar.value) return 30;
      return calendar.value.месяцы[monthIdx]?.дней || 30;
    };

    const updateEventDate = (idx: number, field: string, value: number) => {
      const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
      if (field === 'era') newEvents[idx].date.era = value;
      if (field === 'year') newEvents[idx].date.year = value;
      if (field === 'month') newEvents[idx].date.month = value;
      if (field === 'day') {
        const maxDay = getDaysInMonth(newEvents[idx].date.month);
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
      newEvents.push({
        date: { era: 0, year: 1, month: 0, day: 1 },
        time: { hour: 12, minute: 0 },
        description: '',
        calendar_id: selectedCalendarId.value || undefined
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
      if (!input || !calendar.value) return;

      const inputObj = {
        era_index: currentEvent.date.era,
        year: currentEvent.date.year,
        month: currentEvent.date.month,
        day: currentEvent.date.day,
        hour: currentEvent.time?.hour || 0,
        minute: currentEvent.time?.minute || 0
      };

      const absMins = CalendarMath.getAbsoluteMinute(inputObj, calendar.value);
      const delta = CalendarMath.parseDurationString(input, calendar.value);
      const nextDateObj = CalendarMath.getDateFromAbsolute(absMins + delta, calendar.value, currentEvent.date.era);

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
        calendar_id: selectedCalendarId.value || undefined
      });

      expandedIndices.value.add(idx + 1);
      relativeInput.value[idx] = '';
      emit('update:events', newEvents);
      onChange();
    };

    return {
      wheelHorizontal,
      calendarOptions,
      selectedCalendarId,
      onCalendarChange,
      isExpanded,
      toggleExpand,
      removeEvent,
      getSeasonColor,
      getSeasonName,
      formatEventDate,
      eraOptions,
      updateEventDate,
      onYearInput,
      onDayInput,
      monthOptions,
      getDaysInMonth,
      hourOptions,
      updateEventTime,
      minuteOptions,
      getTimeOfDayColor,
      getTimeOfDayName,
      onChange,
      relativeInput,
      createNextEvent,
      addEvent
    };
  }
});
