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
  JourneyAppearance,
  JourneyFilterMode,
  MultiJourneyResponse,
} from './CharacterJourney.model';
import { buildTimelineItems, buildMultiJourneyTimelineItems } from './composables/useJourneyItemsBuilder';
import { useJourneyFiltersAndGroups } from './composables/useJourneyFiltersAndGroups';
import { enrichJourneyAppearances, enrichMultiJourneyScenes, enrichJourneyEvents } from './composables/useJourneyManuscriptEnricher';
import { isCharacterEntity } from './components/JourneyMultiSelector/useJourneyMultiSelector';

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
      const allEnts = res || [];
      entitiesList.value = allEnts.filter(isCharacterEntity);

      // Clean selected entities of any non-character entities
      const validCharacterIds = new Set(
        entitiesList.value.map((e) => (e.id || '').replace(/^entities:/, ''))
      );
      selectedEntityIds.value = selectedEntityIds.value.filter((id) =>
        validCharacterIds.has(id.replace(/^entities:/, ''))
      );

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
        const [rawMulti, ...individualJourneys] = await Promise.all([
          getMultiCharacterJourney(projectId, selectedEntityIds.value, filterMode.value),
          ...selectedEntityIds.value.map((id) => Promise.resolve(getCharacterJourney(projectId, id)).catch(() => null)),
        ]);
        const resolvedMulti = (rawMulti as MultiJourneyResponse) || { entities: [], scenes: [] };
        if (resolvedMulti && resolvedMulti.scenes && resolvedMulti.scenes.length > 0) {
          resolvedMulti.scenes = await enrichMultiJourneyScenes(projectId, resolvedMulti.scenes);
        }

        const combinedAppearances: JourneyAppearance[] = [];
        for (let i = 0; i < selectedEntityIds.value.length; i++) {
          const singleId = selectedEntityIds.value[i];
          const rawSingle = individualJourneys[i] as (CharacterJourneyData & { entity_name?: string }) | null;
          if (rawSingle && rawSingle.appearances && rawSingle.appearances.length > 0) {
            const cleanSingle = singleId.replace(/^entities:/, '');
            const activeEntity = entitiesList.value.find((e) => (e.id || '').replace(/^entities:/, '') === cleanSingle);
            const entityName = activeEntity?.name || rawSingle.entity?.name || rawSingle.entity_name || '';
            const aliases = (activeEntity?.attributes?.aliases as string[]) || (rawSingle.attributes?.aliases as string[]) || [];

            const enriched = await enrichJourneyAppearances(
              projectId,
              rawSingle.appearances,
              singleId,
              entityName,
              aliases,
              rawSingle.promises || []
            );

            for (const app of enriched) {
              combinedAppearances.push({
                ...app,
                entity_id: singleId,
                entity_name: entityName,
              });
            }
          }
        }

        resolvedMulti.appearances = combinedAppearances;
        multiData.value = resolvedMulti;
        data.value = null;
      } else {
        const singleId = selectedEntityIds.value[0];
        const raw = await getCharacterJourney(projectId, singleId);
        const resolvedData = (raw as CharacterJourneyData) || {
          appearances: [],
          events: [],
          relations: [],
          promises: [],
        };

        const cleanSingle = singleId.replace(/^entities:/, '');
        const activeEntity = entitiesList.value.find((e) => (e.id || '').replace(/^entities:/, '') === cleanSingle);
        const entityName = activeEntity?.name || resolvedData.entity?.name || '';
        const aliases = (activeEntity?.attributes?.aliases as string[]) || (resolvedData.attributes?.aliases as string[]) || [];

        if (resolvedData.appearances && resolvedData.appearances.length > 0) {
          resolvedData.appearances = await enrichJourneyAppearances(
            projectId,
            resolvedData.appearances,
            singleId,
            entityName,
            aliases,
            resolvedData.promises || []
          );
        }

        if (resolvedData.events && resolvedData.events.length > 0) {
          resolvedData.events = await enrichJourneyEvents(projectId, resolvedData.events);
        }

        data.value = resolvedData;
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
      return buildMultiJourneyTimelineItems(multiData.value, storyArcsStore.arcs, filterMode.value);
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

