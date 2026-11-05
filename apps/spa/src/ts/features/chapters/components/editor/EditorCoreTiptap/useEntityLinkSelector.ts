import { ref, computed, watch, nextTick } from 'vue';
import * as api from '@/services/api.client';
import type { EntitySchema } from '@/types/generated/EntitySchema';
import { computeCleanSearchQuery, filterMatchingEntities } from './utils/entitySelectorFiltering';
import { mapRawEntityToSelectorItem } from './utils/entitySelectorHelpers';
import { executeQuickCreate, handleEntityTaggingOnSelect } from './utils/entitySelectorOps';
import type {
  EntityTypeItem,
  EntitySelectorItem,
  EntityLinkSelectorProps,
  EntityLinkSelectorEmits
} from './EntityLinkSelector.model';

export function useEntityLinkSelector(
  props: EntityLinkSelectorProps,
  emit: EntityLinkSelectorEmits
) {
  const searchQuery = ref('');
  const sourceMention = ref('');
  const saveAsTag = ref(true);
  const activeTypeFilter = ref<string>('all');
  const selectedIndex = ref(0);
  const searchInput = ref<HTMLInputElement | null>(null);
  const listEl = ref<HTMLElement | null>(null);
  const isCreating = ref(false);

  const loadedSchemas = ref<EntitySchema[]>([]);
  const rawEntities = ref<EntitySelectorItem[]>([]);

  const entityTypes = computed<EntityTypeItem[]>(() => {
    return loadedSchemas.value.map((s) => ({
      id: s.type_key,
      name: s.type_name,
      icon: (s as { icon?: string }).icon || '📌'
    }));
  });

  const schemaMap = computed(() => {
    const map = new Map<string, EntityTypeItem>();
    for (const t of entityTypes.value) {
      map.set(t.id, t);
    }
    return map;
  });

  const allEntities = computed<EntitySelectorItem[]>(() => {
    return rawEntities.value.map(r => mapRawEntityToSelectorItem(r, schemaMap.value));
  });

  const cleanSearchQuery = computed(() => computeCleanSearchQuery(searchQuery.value));

  const availableCreationTypes = computed<EntityTypeItem[]>(() => {
    if (entityTypes.value.length > 0) return entityTypes.value;
    return [
      { id: 'character', name: 'Персонаж', icon: '👤' },
      { id: 'location', name: 'Локация', icon: '📍' },
      { id: 'item', name: 'Предмет', icon: '⚔️' },
      { id: 'faction', name: 'Фракция', icon: '🛡️' }
    ];
  });

  const matchingEntities = computed(() => {
    return filterMatchingEntities(
      allEntities.value,
      searchQuery.value,
      cleanSearchQuery.value,
      activeTypeFilter.value
    );
  });

  const isFallbackList = computed(() => {
    return cleanSearchQuery.value.length > 0 && matchingEntities.value.length === 0 && allEntities.value.length > 0;
  });

  const filteredEntities = computed(() => {
    if (matchingEntities.value.length > 0) return matchingEntities.value;
    if (cleanSearchQuery.value) {
      let list = allEntities.value;
      if (activeTypeFilter.value !== 'all') {
        list = list.filter(e => e.entity_type === activeTypeFilter.value);
      }
      return list;
    }
    return [];
  });

  const otherEntities = computed(() => {
    if (!cleanSearchQuery.value || matchingEntities.value.length === 0) return [];
    const matchIds = new Set(matchingEntities.value.map(e => e.id));
    let list = allEntities.value.filter(e => !matchIds.has(e.id));
    if (activeTypeFilter.value !== 'all') {
      list = list.filter(e => e.entity_type === activeTypeFilter.value);
    }
    return list;
  });

  const allSelectableEntities = computed(() => {
    if (cleanSearchQuery.value && matchingEntities.value.length > 0 && otherEntities.value.length > 0) {
      return [...matchingEntities.value, ...otherEntities.value];
    }
    return filteredEntities.value;
  });

  const quickCreateName = computed(() => cleanSearchQuery.value || sourceMention.value);

  const showQuickCreate = computed(() => {
    const q = quickCreateName.value;
    if (!q || isCreating.value) return false;
    const lowerQ = q.toLowerCase();
    return !allEntities.value.some(e => e.name.toLowerCase() === lowerQ);
  });

  const totalItemsCount = computed(() => allSelectableEntities.value.length + (showQuickCreate.value ? 1 : 0));
  const isModalOpen = computed(() => props.isOpen);

  const loadData = async () => {
    if (!props.project) return;
    try {
      const [schemas, entities] = await Promise.all([
        api.getEntitySchemas(props.project),
        api.getEntities(props.project, null)
      ]);
      loadedSchemas.value = schemas;
      rawEntities.value = (entities || []) as unknown as EntitySelectorItem[];
    } catch (e) {
      console.error('Failed to load entity selector data', e);
    }
  };

  const sanitizeMention = (query?: string): string => {
    if (!query) return '';
    return query.trim().replace(/^\(\(/, '').replace(/\)\)$/, '').replace(/^#/, '').trim();
  };

  watch(isModalOpen, async (open) => {
    if (open) {
      const mention = sanitizeMention(props.initialQuery);
      sourceMention.value = mention;
      saveAsTag.value = true;
      searchQuery.value = mention;
      activeTypeFilter.value = 'all';
      selectedIndex.value = 0;
      await loadData();
      void nextTick(() => {
        searchInput.value?.focus();
        if (searchQuery.value) searchInput.value?.select();
      });
    }
  }, { immediate: true });

  watch(() => props.initialQuery, (newQ) => {
    if (props.isOpen && newQ !== undefined) {
      const mention = sanitizeMention(newQ);
      sourceMention.value = mention;
      searchQuery.value = mention;
    }
  });

  watch([searchQuery, activeTypeFilter], () => {
    selectedIndex.value = 0;
  });

  const moveSelection = (dir: number) => {
    const max = totalItemsCount.value - 1;
    if (max < 0) return;
    selectedIndex.value += dir;
    if (selectedIndex.value < 0) selectedIndex.value = max;
    if (selectedIndex.value > max) selectedIndex.value = 0;

    void nextTick(() => {
      if (listEl.value) {
        const activeEl = listEl.value.querySelector('.selector-item.active') as HTMLElement;
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  const selectCurrent = () => {
    if (selectedIndex.value < allSelectableEntities.value.length) {
      const entity = allSelectableEntities.value[selectedIndex.value];
      if (entity) selectEntity(entity);
    } else if (showQuickCreate.value) {
      void quickCreateEntity();
    }
  };

  const selectEntity = (entity: EntitySelectorItem) => {
    if (!entity) return;
    const targetTag = saveAsTag.value ? (sourceMention.value || cleanSearchQuery.value) : '';
    if (targetTag && props.project) {
      handleEntityTaggingOnSelect(entity as Record<string, unknown>, targetTag, props.project);
    }
    emit('insert', { type: entity.entity_type, id: entity.id, name: entity.name });
    close();
  };

  const quickCreateEntity = async (typeKey?: string) => {
    const name = quickCreateName.value;
    if (!name || isCreating.value) return;
    const chosenType = typeKey || (activeTypeFilter.value !== 'all' ? activeTypeFilter.value : availableCreationTypes.value[0]?.id || 'character');

    isCreating.value = true;
    try {
      const created = await executeQuickCreate({
        name,
        chosenType,
        sourceMention: sourceMention.value,
        saveAsTag: saveAsTag.value,
        project: props.project,
        loadedSchemas: loadedSchemas.value
      });
      emit('insert', created);
      close();
    } catch (e) {
      console.error('Failed to quick-create entity', e);
    } finally {
      isCreating.value = false;
    }
  };

  const setTypeFilter = (typeKey: string) => {
    activeTypeFilter.value = typeKey;
  };

  const close = () => {
    emit('close');
  };

  return {
    searchQuery,
    cleanSearchQuery,
    sourceMention,
    saveAsTag,
    activeTypeFilter,
    selectedIndex,
    searchInput,
    listEl,
    isCreating,
    entityTypes,
    availableCreationTypes,
    filteredEntities,
    otherEntities,
    allSelectableEntities,
    isFallbackList,
    showQuickCreate,
    quickCreateName,
    moveSelection,
    selectCurrent,
    selectEntity,
    quickCreateEntity,
    setTypeFilter,
    close
  };
}
