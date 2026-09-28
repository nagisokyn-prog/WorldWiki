import { ref, computed, watch, onMounted } from 'vue';
import { getCharacterJourney, getEntities } from '@/services/api.client';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { useCalendarStore } from '@/stores/calendar.store';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { Entity } from '@/types/generated/Entity';
import type {
  CharacterJourneyData,
  CharacterJourneyViewMode,
} from './CharacterJourney.model';
import { buildTimelineItems } from './hooks/useJourneyItemsBuilder';
import { useJourneyFiltersAndGroups } from './hooks/useJourneyFiltersAndGroups';

export function useCharacterJourney(projectId: string, initialEntityId?: string) {
  const storyArcsStore = useStoryArcsStore();
  const calendarStore = useCalendarStore();
  const currentEntityId = ref<string>(initialEntityId || '');
  const data = ref<CharacterJourneyData | null>(null);
  const entitiesList = ref<Entity[]>([]);
  const calendarData = ref<CalendarData | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const viewMode = ref<CharacterJourneyViewMode>('BY_ARCS');
  const selectedArcFilter = ref<string>('ALL');
  const filterType = ref<string>('all');

  const loadCalendars = async () => {
    if (!projectId) {
      calendarData.value = CalendarFormat.getDefaultCalendar();
      return;
    }
    try {
      const cals = await calendarStore.getCalendars(projectId);
      if (cals && cals.length > 0) {
        const master = cals.find((c) => c.is_master) || cals.find((c) => c.is_default) || cals[0];
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
      if (!currentEntityId.value && entitiesList.value.length > 0) {
        currentEntityId.value = entitiesList.value[0].id || '';
      }
    } catch (err) {
      console.warn('[useCharacterJourney] Failed to fetch entities list:', err);
    }
  };

  const loadJourney = async () => {
    if (!projectId || !currentEntityId.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      await storyArcsStore.loadArcs(projectId);
      await loadCalendars();
      const raw = await getCharacterJourney(projectId, currentEntityId.value);
      data.value = (raw as CharacterJourneyData) || {
        appearances: [],
        events: [],
        relations: [],
        promises: [],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[useCharacterJourney ERROR] Error loading journey:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const allTimelineItems = computed(() => {
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
    const clean = (currentEntityId.value || '').replace(/^entities:/, '');
    return entitiesList.value.find((e) => (e.id || '').replace(/^entities:/, '') === clean) || null;
  });

  const selectEntity = (id: string) => {
    currentEntityId.value = id;
    loadJourney();
  };

  watch(() => initialEntityId, (newId) => {
    if (newId && newId !== currentEntityId.value) {
      currentEntityId.value = newId;
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
    currentEntityId,
    currentEntity,
    entitiesList,
    isLoading,
    error,
    viewMode,
    selectedArcFilter,
    filterType,
    timelineItems: filteredTimelineItems,
    arcGroups,
    storyArcs,
    selectEntity,
    refresh: loadJourney,
  };
}
