import { ref, computed, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import { useCalendarStore, type CalendarRecord } from '@/stores/calendar.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { usePromiseDateTime } from './usePromiseDateTime';
import { usePromiseParticipants } from './usePromiseParticipants';
import type { RichPlotPromise } from '../usePromisesPanel';
import type { SceneArcItem } from './PromiseCardArcTags.model';
import type {
  PromiseCardMetaProps,
  PromiseCardMetaEmits,
  ProjectEntityOption,
  TimelineEventOption
} from './PromiseCardMeta.model';

export function usePromiseCardMeta(
  props: PromiseCardMetaProps,
  emit: PromiseCardMetaEmits
) {
  const isEditingMeta = ref(false);
  const locationDraft = ref(props.item.location_id || '');

  const arcsStore = useStoryArcsStore();
  const availableArcs = computed(() => arcsStore.arcs);
  const localArcId = ref<string | null>(props.item.arc_id ?? null);
  const localArcPhase = ref<string>(props.item.arc_phase ?? 'setup');

  const projectLocations = ref<ProjectEntityOption[]>([]);
  const projectCharacters = ref<ProjectEntityOption[]>([]);
  const projectTimelineEvents = ref<TimelineEventOption[]>([]);
  const calendarStore = useCalendarStore();
  const calendars = ref<CalendarRecord[]>([]);
  const dateTime = usePromiseDateTime(calendars, () => emit('change'));
  const participants = usePromiseParticipants(props, projectCharacters, emit);

  const loadProjectEntities = async () => {
    if (!props.project) return;
    try {
      const [locs, places, chars, timelineData, calList] = await Promise.all([
        api.getEntities(props.project, 'location').catch(() => []),
        api.getEntities(props.project, 'place').catch(() => []),
        api.getEntities(props.project, 'character').catch(() => []),
        api.getGlobalTimeline(props.project).catch(() => null),
        calendarStore.getCalendars(props.project).catch(() => []),
        arcsStore.loadArcs(props.project).catch(() => [])
      ]);

      calendars.value = calList || [];

      const allLocs: ProjectEntityOption[] = [];
      const seenLocs = new Set<string>();

      const addLocList = (list: unknown[], type: string) => {
        if (Array.isArray(list)) {
          for (const item of list) {
            const ent = item as { id?: string; name?: string; title?: string };
            const id = ent.id || '';
            const name = ent.name || ent.title || id;
            if (id && !seenLocs.has(id)) {
              seenLocs.add(id);
              allLocs.push({ id, name, type });
            }
          }
        }
      };

      addLocList(locs, 'location');
      addLocList(places, 'place');
      projectLocations.value = allLocs;

      if (Array.isArray(chars)) {
        projectCharacters.value = chars.map((c: unknown) => {
          const char = c as { id?: string; name?: string; title?: string };
          return {
            id: char.id || '',
            name: char.name || char.title || char.id || '',
            type: 'character'
          };
        }).filter(c => Boolean(c.id));
      }

      const eventsList: TimelineEventOption[] = [];
      const seenEventIds = new Set<string>();

      if (Array.isArray(timelineData)) {
        for (const ch of timelineData as Array<{ id?: string; title?: string; timeline_events?: Array<{ id?: string; title?: string; name?: string; m_abs?: number }> }>) {
          const chTitle = ch.title || (ch.id ? ch.id.replace(/^chapters:/, 'Глава ') : 'Глава');
          if (Array.isArray(ch.timeline_events)) {
            for (const ev of ch.timeline_events) {
              if (ev.id && !seenEventIds.has(ev.id)) {
                seenEventIds.add(ev.id);
                eventsList.push({
                  id: ev.id,
                  title: `[${chTitle}] ${ev.title || ev.name || ev.id}`,
                  m_abs: ev.m_abs
                });
              }
            }
          }
        }
      } else if (timelineData && typeof timelineData === 'object') {
        const events = (timelineData as { events?: Array<{ id?: string; title?: string; name?: string; m_abs?: number }> }).events || [];
        if (Array.isArray(events)) {
          for (const ev of events) {
            if (ev.id && !seenEventIds.has(ev.id)) {
              seenEventIds.add(ev.id);
              eventsList.push({
                id: ev.id,
                title: ev.title || ev.name || ev.id || 'Событие',
                m_abs: ev.m_abs
              });
            }
          }
        }
      }

      projectTimelineEvents.value = eventsList;
      dateTime.syncInitialTimelineDate(props.item, props.item.timeline_event_id, eventsList);
    } catch {
      // ignore
    }
  };

  watch(() => props.item.location_id, (val) => {
    locationDraft.value = val || '';
  });

  watch(() => props.item.arc_id, (val) => {
    localArcId.value = val ?? null;
  });

  watch(() => props.item.arc_phase, (val) => {
    localArcPhase.value = val ?? 'setup';
  });

  watch(() => [props.item.date_fields, props.item.m_abs, props.item.calendar_id], () => {
    dateTime.syncInitialTimelineDate(props.item, props.item.timeline_event_id, projectTimelineEvents.value);
  }, { deep: true });

  watch(() => props.project, loadProjectEntities);
  onMounted(loadProjectEntities);

  const saveLocation = () => {
    const val = locationDraft.value.trim();
    if (val === (props.item.location_id || '')) return;
    const updated = {
      ...props.item,
      location_id: val || null
    };
    emit('update:item', updated);
    emit('change');
  };

  const updateKind = (newKind: string) => {
    if (newKind === props.item.kind) return;
    const updated = {
      ...props.item,
      kind: newKind
    };
    emit('update:item', updated);
    emit('change');
  };

  const onArcsUpdate = (newArcs: SceneArcItem[]) => {
    const first = newArcs[0];
    const updated: RichPlotPromise = {
      ...props.item,
      arcs: newArcs,
      arc_id: first?.arc_id ? String(first.arc_id) : null,
      arc_phase: first?.arc_id ? String(first.arc_phase || 'setup') : null
    };
    emit('update:item', updated);
    emit('change');
  };

  const onArcChange = () => {
    const aid = localArcId.value ? String(localArcId.value) : null;
    const aphase = aid ? (localArcPhase.value || 'setup') : null;
    const updated: RichPlotPromise = {
      ...props.item,
      arc_id: aid,
      arc_phase: aphase,
      arcs: aid ? [{ arc_id: aid, arc_phase: aphase }] : []
    };
    emit('update:item', updated);
    emit('change');
  };

  const handleDateFieldsChange = () => {
    dateTime.onDateFieldsChange();
    const model = dateTime.universalDateModel.value;
    const cal = dateTime.activeCalendar.value;
    const updated: RichPlotPromise = {
      ...props.item,
      m_abs: model?.absolute_minute ?? null,
      calendar_id: cal?.id || model?.calendar_id || null,
      date_fields: model?.original_input ? {
        era_index: model.original_input.era_index,
        year: model.original_input.year,
        month: model.original_input.month,
        day: model.original_input.day,
        hour: model.original_input.hour,
        minute: model.original_input.minute
      } : {
        era_index: dateTime.currentEraIdx.value,
        year: dateTime.currentYear.value,
        month: dateTime.currentMonthIdx.value,
        day: dateTime.currentDay.value,
        hour: dateTime.currentHour.value,
        minute: dateTime.currentMinute.value
      }
    };
    emit('update:item', updated);
    emit('change');
  };

  const handleCalendarChange = (calId: string) => {
    dateTime.setCalendar(calId);
    handleDateFieldsChange();
  };

  const handleUniversalDateChange = (val: unknown) => {
    dateTime.onUniversalDateChange(val);
    handleDateFieldsChange();
  };

  return {
    isEditingMeta,
    locationDraft,
    availableArcs,
    localArcId,
    localArcPhase,
    projectLocations,
    projectCharacters,
    projectTimelineEvents,
    calendars,
    participantInputQuery: participants.participantInputQuery,
    isParticipantDropdownOpen: participants.isParticipantDropdownOpen,
    currentParticipants: participants.currentParticipants,
    availableCharacters: participants.availableCharacters,
    getParticipantDisplayName: participants.getParticipantDisplayName,
    addParticipant: participants.addParticipant,
    removeParticipant: participants.removeParticipant,
    handleParticipantBackspace: participants.handleParticipantBackspace,
    isDatePickerOpen: dateTime.isDatePickerOpen,
    currentCalendarId: dateTime.currentCalendarId,
    currentEraIdx: dateTime.currentEraIdx,
    currentYear: dateTime.currentYear,
    currentMonthIdx: dateTime.currentMonthIdx,
    currentDay: dateTime.currentDay,
    currentHour: dateTime.currentHour,
    currentMinute: dateTime.currentMinute,
    universalDateModel: dateTime.universalDateModel,
    activeCalendar: dateTime.activeCalendar,
    activeCalendarMonths: dateTime.activeCalendarMonths,
    activeCalendarEras: dateTime.activeCalendarEras,
    maxDaysInCurrentMonth: dateTime.maxDaysInCurrentMonth,
    eraWheelOptions: dateTime.eraWheelOptions,
    yearWheelOptions: dateTime.yearWheelOptions,
    monthWheelOptions: dateTime.monthWheelOptions,
    dayWheelOptions: dateTime.dayWheelOptions,
    hourWheelOptions: dateTime.hourWheelOptions,
    minuteWheelOptions: dateTime.minuteWheelOptions,
    diegeticInfo: dateTime.diegeticInfo,
    onUniversalDateChange: handleUniversalDateChange,
    onDateFieldsChange: handleDateFieldsChange,
    onCalendarChange: handleCalendarChange,
    toggleDatePicker: dateTime.toggleDatePicker,
    saveLocation,
    updateKind,
    onArcChange,
    onArcsUpdate,
    loadProjectEntities
  };
}
