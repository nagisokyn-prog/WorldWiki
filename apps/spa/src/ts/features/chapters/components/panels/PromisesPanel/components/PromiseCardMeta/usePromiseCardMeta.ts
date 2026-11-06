import { ref, computed, watch, onMounted } from 'vue';
import { useCalendarStore, type CalendarRecord } from '@/stores/calendar.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { usePromiseDateTime } from '../usePromiseDateTime';
import { usePromiseParticipants } from '../usePromiseParticipants';
import { usePromiseCardLocation } from '../usePromiseCardLocation';
import { fetchPromiseCardEntities } from '../usePromiseCardEntitiesLoader';
import type { RichPlotPromise } from '../../usePromisesPanel';
import type { SceneArcItem } from '../PromiseCardArcTags/PromiseCardArcTags.model';
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
  const location = usePromiseCardLocation(props, projectLocations, emit);

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

  const updateKind = (newKind: string) => {
    if (newKind === props.item.kind) return;
    const updated = {
      ...props.item,
      kind: newKind
    };
    emit('update:item', updated);
    emit('change');
  };

  const effectiveArcs = computed<SceneArcItem[]>(() => {
    if (Array.isArray(props.item.arcs) && props.item.arcs.length > 0) {
      return props.item.arcs;
    }
    if (props.item.arc_id) {
      return [{
        arc_id: props.item.arc_id,
        arc_phase: props.item.arc_phase ?? 'setup'
      }];
    }
    return [];
  });

  const onArcsUpdate = (newArcs: SceneArcItem[]) => {
    const primary = newArcs[0];
    const updated: RichPlotPromise = {
      ...props.item,
      arcs: newArcs,
      arc_id: primary?.arc_id ? String(primary.arc_id) : null,
      arc_phase: primary?.arc_phase ? String(primary.arc_phase) : (primary?.arc_id ? 'setup' : null)
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

  const onEraChange = (newEraIdx: number) => {
    dateTime.currentEraIdx.value = newEraIdx;
    const era = dateTime.activeCalendarEras.value[newEraIdx];
    if (era) {
      const min = era.год_начала ?? 1;
      const max = era.год_конца ?? (min + 100);
      if (dateTime.currentYear.value < min || dateTime.currentYear.value > max) {
        dateTime.currentYear.value = min;
      }
    }
    handleDateFieldsChange();
  };

  const onYearChange = (newYear: number) => {
    const era = dateTime.activeCalendarEras.value[dateTime.currentEraIdx.value];
    let clampedYear = newYear;
    if (era) {
      const min = era.год_начала ?? 1;
      const max = era.год_конца ?? (min + 100);
      clampedYear = Math.min(max, Math.max(min, newYear));
    }
    dateTime.currentYear.value = clampedYear;
    handleDateFieldsChange();
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
    locationDraft: location.locationDraft,
    isLocationDropdownOpen: location.isLocationDropdownOpen,
    filteredLocations: location.filteredLocations,
    getLocationDisplayName: location.getLocationDisplayName,
    isEntityLocation: location.isEntityLocation,
    selectLocation: location.selectLocation,
    onLocationBlur: location.onLocationBlur,
    clearLocation: location.clearLocation,
    saveLocation: location.saveLocation,
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
    eraMinYear: dateTime.eraMinYear,
    eraMaxYear: dateTime.eraMaxYear,
    diegeticInfo: dateTime.diegeticInfo,
    onEraChange,
    onYearChange,
    onUniversalDateChange: handleUniversalDateChange,
    onDateFieldsChange: handleDateFieldsChange,
    onCalendarChange: handleCalendarChange,
    toggleDatePicker: dateTime.toggleDatePicker,
    updateKind,
    effectiveArcs,
    onArcChange,
    onArcsUpdate,
    loadProjectEntities
  };
}
