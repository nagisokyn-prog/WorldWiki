import { ref, computed, watch, onMounted } from 'vue';
import { useCalendarStore, type CalendarRecord } from '@/stores/calendar.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { usePromiseDateTime } from './usePromiseDateTime';
import { usePromiseParticipants } from './usePromiseParticipants';
import { usePromiseCardLocation } from './usePromiseCardLocation';
import { fetchPromiseCardEntities } from './usePromiseCardEntitiesLoader';
import { buildDateUpdatedPromise, buildCopiedDatePromise, buildCopiedContextPromise } from './promiseCardMeta.helpers';
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

  const applySharedEntities = (shared: {
    calendars: CalendarRecord[];
    locations: ProjectEntityOption[];
    characters: ProjectEntityOption[];
    timelineEvents: TimelineEventOption[];
  }) => {
    calendars.value = shared.calendars;
    projectLocations.value = shared.locations;
    projectCharacters.value = shared.characters;
    projectTimelineEvents.value = shared.timelineEvents;
    dateTime.syncInitialTimelineDate(props.item, props.item.timeline_event_id, shared.timelineEvents);
  };

  const loadProjectEntities = async () => {
    if (props.sharedEntities) {
      applySharedEntities(props.sharedEntities);
      return;
    }
    if (!props.project) return;
    try {
      const res = await fetchPromiseCardEntities(props.project, calendarStore, arcsStore);
      applySharedEntities(res);
    } catch (err) {
      console.warn('[usePromiseCardMeta] Failed to load project timeline events:', err);
    }
  };

  watch(() => props.sharedEntities, (val) => {
    if (val) applySharedEntities(val);
  }, { immediate: true });

  watch(() => props.item.arc_id, (val) => {
    localArcId.value = val ?? null;
  });

  watch(() => props.item.arc_phase, (val) => {
    localArcPhase.value = val ?? 'setup';
  });

  watch(() => [
    props.item.date_fields,
    props.item.m_abs,
    props.item.m_abs_end,
    props.item.date_precision,
    props.item.is_approximate,
    props.item.time_of_day,
    props.item.calendar_id
  ], () => {
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
    const updated = buildDateUpdatedPromise(props.item, {
      model: dateTime.universalDateModel.value,
      calendarId: dateTime.activeCalendar.value?.id || null,
      mAbsEnd: dateTime.computedMabsEnd.value,
      datePrecision: dateTime.datePrecision.value,
      isApproximate: dateTime.isApproximate.value,
      timeOfDay: dateTime.timeOfDay.value,
      fallbackFields: {
        era_index: dateTime.currentEraIdx.value,
        year: dateTime.currentYear.value,
        month: dateTime.currentMonthIdx.value,
        day: dateTime.currentDay.value,
        hour: dateTime.currentHour.value,
        minute: dateTime.currentMinute.value
      }
    });
    emit('update:item', updated);
    emit('change');
  };

  const onShiftMinutes = (deltaMinutes: number) => { dateTime.shiftByMinutes(deltaMinutes); handleDateFieldsChange(); };
  const onShiftPreset = (preset: Parameters<typeof dateTime.shiftByPreset>[0]) => { dateTime.shiftByPreset(preset); handleDateFieldsChange(); };
  const onTimeOfDaySelect = (preset: RichPlotPromise['time_of_day']) => { dateTime.applyTimeOfDay(preset ?? null); handleDateFieldsChange(); };
  const onPrecisionChange = (precision: NonNullable<RichPlotPromise['date_precision']>) => { dateTime.setPrecision(precision); handleDateFieldsChange(); };
  const onSeasonChange = (seasonIdx: number) => { dateTime.onSeasonChange(seasonIdx); handleDateFieldsChange(); };
  const onToggleApproximate = () => { dateTime.toggleApproximate(); handleDateFieldsChange(); };
  const onEndYearChange = (val: number) => { dateTime.endYear.value = Math.max(dateTime.currentYear.value, val); handleDateFieldsChange(); };
  const onEndMonthChange = (val: number) => { dateTime.endMonthIdx.value = val; handleDateFieldsChange(); };

  const copyDateFromPrevious = () => {
    if (!props.previousScene || props.previousScene.m_abs == null) return;
    const updated = buildCopiedDatePromise(props.item, props.previousScene);
    dateTime.syncInitialTimelineDate(updated, updated.timeline_event_id, projectTimelineEvents.value);
    emit('update:item', updated);
    emit('change');
  };

  const copyContextFromPrevious = () => {
    if (!props.previousScene) return;
    emit('update:item', buildCopiedContextPromise(props.item, props.previousScene));
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

  const blockBadgeText = computed(() => {
    if (props.item.block_ids && props.item.block_ids.length > 0) {
      if (props.item.block_ids.length === 1) {
        return props.item.block_ids[0];
      }
      return `${props.item.block_ids[0]}..${props.item.block_ids[props.item.block_ids.length - 1]} (${props.item.block_ids.length})`;
    }
    return props.item.block_id || null;
  });

  return {
    isEditingMeta, blockBadgeText,
    locationDraft: location.locationDraft, isLocationDropdownOpen: location.isLocationDropdownOpen,
    filteredLocations: location.filteredLocations, getLocationDisplayName: location.getLocationDisplayName,
    isEntityLocation: location.isEntityLocation, selectLocation: location.selectLocation,
    onLocationBlur: location.onLocationBlur, clearLocation: location.clearLocation, saveLocation: location.saveLocation,
    availableArcs, localArcId, localArcPhase, projectLocations, projectCharacters, projectTimelineEvents, calendars,
    participantInputQuery: participants.participantInputQuery, isParticipantDropdownOpen: participants.isParticipantDropdownOpen,
    currentParticipants: participants.currentParticipants, availableCharacters: participants.availableCharacters,
    getParticipantDisplayName: participants.getParticipantDisplayName, addParticipant: participants.addParticipant,
    removeParticipant: participants.removeParticipant, handleParticipantBackspace: participants.handleParticipantBackspace,
    ...dateTime,
    onEraChange, onYearChange, onShiftMinutes, onShiftPreset, onTimeOfDaySelect, onPrecisionChange, onSeasonChange,
    onToggleApproximate, onEndYearChange, onEndMonthChange, copyDateFromPrevious, copyContextFromPrevious,
    onUniversalDateChange: handleUniversalDateChange, onDateFieldsChange: handleDateFieldsChange,
    onCalendarChange: handleCalendarChange, updateKind, effectiveArcs, onArcChange, onArcsUpdate, loadProjectEntities
  };
}
