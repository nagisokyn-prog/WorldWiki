import { ref, computed, watch, onMounted } from 'vue';
import { getCharacterJourney, getMultiCharacterJourney, getEntities } from '@/services/api.client';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { useCalendarStore } from '@/stores/calendar.store';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { Entity } from '@/types/generated/Entity';
import type {
  CharacterJourneyData,
  CharacterJourneyViewMode,
  JourneyFilterMode,
  MultiJourneyResponse,
} from './CharacterJourney.model';
import { buildTimelineItems, buildMultiJourneyTimelineItems } from './hooks/useJourneyItemsBuilder';
import { useJourneyFiltersAndGroups } from './hooks/useJourneyFiltersAndGroups';

export function useCharacterJourney(projectId: string, initialEntityId?: string) {
  const storyArcsStore = useStoryArcsStore();
  const calendarStore = useCalendarStore();

  const selectedEntityIds = ref<string[]>(initialEntityId ? [initialEntityId] : []);
  const currentEntityId = computed<string>({
    get: () => selectedEntityIds.value[0] || '',
    set: (val: string) => {
      selectedEntityIds.value = val ? [val] : [];
    },
  });

  const filterMode = ref<JourneyFilterMode>('union');
  const data = ref<CharacterJourneyData | null>(null);
  const multiData = ref<MultiJourneyResponse | null>(null);
  const entitiesList = ref<Entity[]>([]);
  const calendarData = ref<CalendarData | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const viewMode = ref<CharacterJourneyViewMode>('BY_ARCS');
  const selectedArcFilter = ref<string>('ALL');
  const filterType = ref<string>('all');

  const isMultiEntity = computed(() => selectedEntityIds.value.length > 1);

  const loadCalendars = async () => {
    if (!projectId) {
      calendarData.value = CalendarFormat.getDefaultCalendar();
      return;
    }
    try {
      const cals = await calendarStore.getCalendars(projectId);
      if (cals && cals.length > 0) {
        const master = cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_master) || cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_default) || cals[0];
        calendarData.value = (master?.data as CalendarData) || (master as unknown as CalendarData) || null;
      }
      if (!calendarData.value) {
        calendarData.value = CalendarFormat.getDefaultCalendar();
      }
    } catch (err) {
      console.warn('[useCharacterJourney] Failed to load calendars:', err);
      calendarData.value = CalendarFormat.getDefaultCalendar();
    }
  };

  const loadEntities = async () => {
    if (!projectId) return;
    try {
      const res = await getEntities(projectId, null);
      entitiesList.value = res || [];
      if (selectedEntityIds.value.length === 0 && entitiesList.value.length > 0) {
        const firstId = entitiesList.value[0].id || '';
        if (firstId) {
          selectedEntityIds.value = [firstId];
        }
      }
    } catch (err) {
      console.warn('[useCharacterJourney] Failed to fetch entities list:', err);
    }
  };

  const loadJourney = async () => {
    if (!projectId || selectedEntityIds.value.length === 0) {
      data.value = null;
      multiData.value = null;
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      await storyArcsStore.loadArcs(projectId);
      await loadCalendars();

      if (selectedEntityIds.value.length > 1) {
        const rawMulti = await getMultiCharacterJourney(projectId, selectedEntityIds.value, filterMode.value);
        multiData.value = (rawMulti as MultiJourneyResponse) || null;
        data.value = null;
      } else {
        const singleId = selectedEntityIds.value[0];
        const raw = await getCharacterJourney(projectId, singleId);
        data.value = (raw as CharacterJourneyData) || {
          appearances: [],
          events: [],
          relations: [],
          promises: [],
        };
        multiData.value = null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[useCharacterJourney ERROR] Error loading journey:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const allTimelineItems = computed(() => {
    if (selectedEntityIds.value.length > 1) {
      return buildMultiJourneyTimelineItems(multiData.value, storyArcsStore.arcs);
    }
    return buildTimelineItems(data.value, storyArcsStore.arcs, calendarData.value);
  });

  const storyArcs = computed(() => storyArcsStore.arcs);

  const { filteredTimelineItems, arcGroups } = useJourneyFiltersAndGroups({
    allTimelineItems,
    storyArcs,
    viewMode,
    selectedArcFilter,
    filterType,
  });

  const currentEntity = computed(() => {
    const firstId = selectedEntityIds.value[0] || '';
    const clean = firstId.replace(/^entities:/, '');
    return entitiesList.value.find((e) => (e.id || '').replace(/^entities:/, '') === clean) || null;
  });

  const selectedEntities = computed(() => {
    return selectedEntityIds.value
      .map((id) => {
        const clean = id.replace(/^entities:/, '');
        return entitiesList.value.find((e) => (e.id || '').replace(/^entities:/, '') === clean);
      })
      .filter((e): e is Entity => e !== undefined);
  });

  const selectEntity = (id: string) => {
    selectedEntityIds.value = id ? [id] : [];
    loadJourney();
  };

  const toggleEntity = (id: string) => {
    const clean = id.replace(/^entities:/, '');
    const idx = selectedEntityIds.value.findIndex((eId) => eId.replace(/^entities:/, '') === clean);
    if (idx >= 0) {
      // Don't allow removing last entity
      if (selectedEntityIds.value.length > 1) {
        selectedEntityIds.value.splice(idx, 1);
        loadJourney();
      }
    } else {
      selectedEntityIds.value.push(id);
      loadJourney();
    }
  };

  const addEntity = (id: string) => {
    const clean = id.replace(/^entities:/, '');
    const exists = selectedEntityIds.value.some((eId) => eId.replace(/^entities:/, '') === clean);
    if (!exists) {
      selectedEntityIds.value.push(id);
      loadJourney();
    }
  };

  const removeEntity = (id: string) => {
    if (selectedEntityIds.value.length <= 1) return;
    const clean = id.replace(/^entities:/, '');
    selectedEntityIds.value = selectedEntityIds.value.filter(
      (eId) => eId.replace(/^entities:/, '') !== clean
    );
    loadJourney();
  };

  const setFilterMode = (mode: JourneyFilterMode) => {
    if (filterMode.value !== mode) {
      filterMode.value = mode;
      if (selectedEntityIds.value.length > 1) {
        loadJourney();
      }
    }
  };

  watch(() => initialEntityId, (newId) => {
    if (newId && !selectedEntityIds.value.includes(newId)) {
      selectedEntityIds.value = [newId];
      loadJourney();
    }
  });

  watch(() => projectId, () => {
    loadEntities();
    loadJourney();
  });

  onMounted(async () => {
    await loadEntities();
    await loadJourney();
  });

  return {
    data,
    multiData,
    selectedEntityIds,
    selectedEntities,
    currentEntityId,
    currentEntity,
    entitiesList,
    isLoading,
    error,
    viewMode,
    selectedArcFilter,
    filterType,
    filterMode,
    isMultiEntity,
    timelineItems: filteredTimelineItems,
    arcGroups,
    storyArcs,
    selectEntity,
    toggleEntity,
    addEntity,
    removeEntity,
    setFilterMode,
    refresh: loadJourney,
  };
}

