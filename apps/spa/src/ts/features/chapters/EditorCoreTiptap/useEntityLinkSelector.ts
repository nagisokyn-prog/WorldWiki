import { ref, computed, watch, nextTick } from 'vue';
import * as api from '../../../services/api.client';
import type { EntitySchema } from '../../../types/generated/EntitySchema';
import { computeSimilarity } from './utils/entityMatch.utils';
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
      icon: s.icon || '📌'
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
    return rawEntities.value.map((r) => {
      let name = 'Без названия';
      if (r.name) name = String(r.name);
      else if ((r as { title?: string }).title) name = String((r as { title?: string }).title) || 'Без названия';
      else if ((r as { fio?: string }).fio) name = String((r as { fio?: string }).fio) || 'Без названия';

      const entityType = String(r.entity_type || (r as { type?: string }).type || 'unknown');
      const schema = schemaMap.value.get(entityType);

      const rawAttrs = (r as { attributes?: Record<string, unknown> }).attributes;
      let rawTags: unknown[] = [];
      if (Array.isArray(r.tags)) rawTags = r.tags;
      else if (rawAttrs && Array.isArray(rawAttrs.tags)) rawTags = rawAttrs.tags;
      else if (rawAttrs && Array.isArray(rawAttrs['теги'])) rawTags = rawAttrs['теги'];
      else if (typeof r.tags === 'string') rawTags = (r.tags as string).split(',');

      const tags = rawTags.map(t => String(t).trim()).filter(Boolean);
      const cleanTags = tags.map(t => t.replace(/^#/, ''));

      const entityId = String(r.id || '');
      const shortId = entityId.split(':').pop() || '';

      return {
        ...r,
        id: entityId,
        shortId,
        name,
        entity_type: entityType,
        type_name: schema?.name || entityType,
        type_icon: schema?.icon || '📌',
        tags,
        cleanTags
      };
    });
  });

  const filteredEntities = computed(() => {
    let list = allEntities.value;

    if (activeTypeFilter.value !== 'all') {
      list = list.filter(e => e.entity_type === activeTypeFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return list;

    const isTagSearch = q.startsWith('#');
    const cleanQ = q.replace(/^#/, '');

    return list.filter((e) => {
      // Поиск по тегам (точное вхождение или сходство >= 50%)
      const matchesTag = e.cleanTags?.some(t => {
        const lower = t.toLowerCase();
        return lower.includes(cleanQ) || computeSimilarity(lower, cleanQ) >= 0.5;
      });

      if (isTagSearch) return matchesTag;

      // Поиск по имени (вхождение или нечёткое сходство >= 50%)
      const lowerName = e.name.toLowerCase();
      const matchesName = lowerName.includes(q) || computeSimilarity(lowerName, q) >= 0.5;
      const matchesId = e.id.toLowerCase().includes(q) || (e.shortId && e.shortId.toLowerCase().includes(q));
      const matchesType = e.type_name?.toLowerCase().includes(q);
      return matchesName || matchesId || matchesType || matchesTag;
    });
  });

  const showQuickCreate = computed(() => {
    const q = searchQuery.value.trim();
    if (!q || isCreating.value) return false;
    const cleanQ = q.replace(/^#/, '').toLowerCase();
    const exists = allEntities.value.some(e => e.name.toLowerCase() === cleanQ || e.name.toLowerCase() === q.toLowerCase());
    return !exists;
  });

  const totalItemsCount = computed(() => {
    return filteredEntities.value.length + (showQuickCreate.value ? 1 : 0);
  });

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

  watch(isModalOpen, async (open) => {
    if (open) {
      searchQuery.value = props.initialQuery ? props.initialQuery.replace(/^\(\(/, '').replace(/\)\)$/, '').trim() : '';
      activeTypeFilter.value = 'all';
      selectedIndex.value = 0;
      await loadData();
      void nextTick(() => {
        searchInput.value?.focus();
        if (searchQuery.value) {
          searchInput.value?.select();
        }
      });
    }
  }, { immediate: true });

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
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }
      }
    });
  };

  const selectCurrent = () => {
    if (selectedIndex.value < filteredEntities.value.length) {
      const entity = filteredEntities.value[selectedIndex.value];
      if (entity) {
        selectEntity(entity);
      }
    } else if (showQuickCreate.value) {
      void quickCreateEntity();
    }
  };

  const selectEntity = (entity: EntitySelectorItem) => {
    const q = searchQuery.value.trim().replace(/^#/, '').replace(/^\(\(/, '').replace(/\)\)$/, '').trim();
    if (q && props.project) {
      const isExactMatch = entity.name.toLowerCase() === q.toLowerCase() ||
        (entity.cleanTags || []).some(t => t.toLowerCase() === q.toLowerCase());
      if (!isExactMatch) {
        const nextTags = Array.from(new Set([...(entity.cleanTags || []), q]));
        void api.saveEntity(props.project, {
          ...entity,
          tags: nextTags,
          attributes: (entity as { attributes?: Record<string, unknown> }).attributes || {}
        } as never).catch((e: unknown) => console.warn('[useEntityLinkSelector] Auto-tagging warning:', e));
        entity.cleanTags = nextTags;
        entity.tags = nextTags;
      }
    }
    emit('insert', {
      type: entity.entity_type,
      id: entity.id,
      name: entity.name
    });
    close();
  };

  const quickCreateEntity = async (typeKey?: string) => {
    const name = searchQuery.value.trim();
    if (!name || isCreating.value) return;

    // Выбираем тип: активный фильтр, либо переданный, либо первый доступный, либо character
    const chosenType = typeKey || (activeTypeFilter.value !== 'all' ? activeTypeFilter.value : entityTypes.value[0]?.id || 'character');

    isCreating.value = true;
    try {
      const payload: Record<string, unknown> = {
        name,
        entity_type: chosenType,
        attributes: {},
        tags: []
      };
      const created = await api.saveEntity(props.project, payload as never);
      const newId = String(created.id || '');
      emit('insert', {
        type: chosenType,
        id: newId,
        name
      });
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
    activeTypeFilter,
    selectedIndex,
    searchInput,
    listEl,
    isCreating,
    entityTypes,
    filteredEntities,
    showQuickCreate,
    moveSelection,
    selectCurrent,
    selectEntity,
    quickCreateEntity,
    setTypeFilter,
    close
  };
}
