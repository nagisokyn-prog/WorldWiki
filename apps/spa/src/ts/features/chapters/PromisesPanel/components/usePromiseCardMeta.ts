import { ref, computed, watch, onMounted } from 'vue';
import { useCalendarStore, type CalendarRecord } from '@/stores/calendar.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { usePromiseDateTime } from './usePromiseDateTime';
import { usePromiseParticipants } from './usePromiseParticipants';
import { fetchPromiseCardEntities } from './usePromiseCardEntitiesLoader';
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
      const res = await fetchPromiseCardEntities(props.project, calendarStore, arcsStore);
      calendars.value = res.calendars;
      projectLocations.value = res.locations;
      projectCharacters.value = res.characters;
      projectTimelineEvents.value = res.timelineEvents;
      dateTime.syncInitialTimelineDate(props.item, props.item.timeline_event_id, res.timelineEvents);
    } catch (err) {
      console.warn('[usePromiseCardMeta] Failed to load project timeline events:', err);
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

  const isLocationDropdownOpen = ref(false);

  const filteredLocations = computed(() => {
    const q = locationDraft.value.trim().toLowerCase();
    if (!q) return projectLocations.value;
    return projectLocations.value.filter(l => l.name.toLowerCase().includes(q));
  });

  const getLocationDisplayName = (locIdOrName: string): string => {
    if (!locIdOrName) return '';
    const clean = String(locIdOrName).trim();
    const found = projectLocations.value.find(l => 
      l.id === clean || 
      l.id.replace(/^(locations|entities):/, '') === clean || 
      l.name.toLowerCase() === clean.toLowerCase()
    );
    return found?.name || clean;
  };

  const selectLocation = (locName: string) => {
    const clean = locName.trim();
    const found = projectLocations.value.find(l => l.name.toLowerCase() === clean.toLowerCase());
    const finalVal = found ? found.name : clean;
    const updated = {
      ...props.item,
      location_id: finalVal || null
    };
    emit('update:item', updated);
    emit('change');
    locationDraft.value = '';
    isLocationDropdownOpen.value = false;
  };

  const clearLocation = () => {
    const updated = {
      ...props.item,
      location_id: null
    };
    emit('update:item', updated);
    emit('change');
    locationDraft.value = '';
    isLocationDropdownOpen.value = false;
  };

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
    isLocationDropdownOpen,
    filteredLocations,
    getLocationDisplayName,
    selectLocation,
    clearLocation,
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
