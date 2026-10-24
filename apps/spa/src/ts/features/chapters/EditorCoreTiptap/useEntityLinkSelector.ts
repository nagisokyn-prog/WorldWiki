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

function extractCleanTags(raw: unknown): string[] {
  if (!raw) return [];
  let items: unknown[] = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) items = parsed;
        else items = [trimmed];
      } catch {
        items = trimmed.split(',');
      }
    } else {
      items = trimmed.split(',');
    }
  }
  const result: string[] = [];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') {
      const clean = item.trim().replace(/^#/, '');
      if (clean) result.push(clean);
    } else if (typeof item === 'object') {
      const name = (item as { name?: string; title?: string; id?: string }).name ||
                   (item as { name?: string; title?: string; id?: string }).title ||
                   (item as { name?: string; title?: string; id?: string }).id;
      if (name && typeof name === 'string') {
        const clean = name.trim().replace(/^#/, '');
        if (clean) result.push(clean);
      }
    }
  }
  return Array.from(new Set(result));
}

function extractAliases(raw: unknown, rawAttrs?: Record<string, unknown>): string[] {
  const sources = [
    raw,
    rawAttrs?.aliases,
    rawAttrs?.['псевдонимы'],
    rawAttrs?.['алиасы']
  ];
  const list: string[] = [];
  for (const s of sources) {
    if (!s) continue;
    if (Array.isArray(s)) {
      for (const item of s) {
        if (typeof item === 'string' && item.trim()) list.push(item.trim());
      }
    } else if (typeof s === 'string') {
      const parts = s.split(',');
      for (const p of parts) {
        if (p.trim()) list.push(p.trim());
      }
    }
  }
  return Array.from(new Set(list));
}

  const allEntities = computed<EntitySelectorItem[]>(() => {
    return rawEntities.value.map((r) => {
      let name = 'Без названия';
      if (r.name) name = String(r.name);
      else if ((r as { title?: string }).title) name = String((r as { title?: string }).title) || 'Без названия';
      else if ((r as { fio?: string }).fio) name = String((r as { fio?: string }).fio) || 'Без названия';

      const entityType = String(r.entity_type || (r as { type?: string }).type || 'unknown');
      const schema = schemaMap.value.get(entityType);

      const rawAttrs = (r as { attributes?: Record<string, unknown> }).attributes;
      const cleanTags = Array.from(new Set([
        ...extractCleanTags(r.tags),
        ...extractCleanTags(rawAttrs?.tags),
        ...extractCleanTags(rawAttrs?.['теги']),
        ...extractCleanTags((r as { tag_names?: unknown }).tag_names)
      ]));

      const aliases = extractAliases((r as { aliases?: unknown }).aliases, rawAttrs);

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
        tags: cleanTags,
        cleanTags,
        aliases
      };
    });
  });

  const cleanSearchQuery = computed(() => {
    return searchQuery.value.trim().replace(/^#/, '').replace(/^\(\(/, '').replace(/\)\)$/, '').trim();
  });

  const availableCreationTypes = computed<EntityTypeItem[]>(() => {
    if (entityTypes.value.length > 0) {
      return entityTypes.value;
    }
    return [
      { id: 'character', name: 'Персонаж', icon: '👤' },
      { id: 'location', name: 'Локация', icon: '📍' },
      { id: 'item', name: 'Предмет', icon: '⚔️' },
      { id: 'faction', name: 'Фракция', icon: '🛡️' }
    ];
  });

  const matchingEntities = computed(() => {
    let list = allEntities.value;

    if (activeTypeFilter.value !== 'all') {
      list = list.filter(e => e.entity_type === activeTypeFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return list;

    const isTagSearch = q.startsWith('#');
    const cleanQ = cleanSearchQuery.value.toLowerCase();

    return list.filter((e) => {
      // Поиск по тегам (точное совпадение, вхождение или нечёткое сходство >= 50%)
      const matchesTag = e.cleanTags?.some(t => {
        const lower = t.toLowerCase();
        return lower === cleanQ || lower.includes(cleanQ) || cleanQ.includes(lower) || computeSimilarity(lower, cleanQ) >= 0.5;
      });

      // Поиск по псевдонимам/алиасам
      const matchesAlias = e.aliases?.some((a: string) => {
        const lower = a.toLowerCase();
        return lower === cleanQ || lower.includes(cleanQ) || cleanQ.includes(lower) || computeSimilarity(lower, cleanQ) >= 0.5;
      });

      if (isTagSearch) return matchesTag;

      // Поиск по имени (вхождение или нечёткое сходство по Левенштейну >= 50%)
      const lowerName = e.name.toLowerCase();
      const matchesName = lowerName === cleanQ || lowerName.includes(cleanQ) || cleanQ.includes(lowerName) || computeSimilarity(lowerName, cleanQ) >= 0.5;
      const matchesId = e.id.toLowerCase().includes(cleanQ) || (e.shortId && e.shortId.toLowerCase().includes(cleanQ));
      const matchesType = e.type_name?.toLowerCase().includes(cleanQ);
      return matchesName || matchesId || matchesType || matchesTag || matchesAlias;
    });
  });

  const isFallbackList = computed(() => {
    return cleanSearchQuery.value.length > 0 && matchingEntities.value.length === 0 && allEntities.value.length > 0;
  });

  const filteredEntities = computed(() => {
    if (matchingEntities.value.length > 0) {
      return matchingEntities.value;
    }
    // Если по поисковому запросу ничего не найдено, но есть сущности,
    // возвращаем список всех сущностей (Use-Case 2: пользователь ввел тег, которого еще нет ни у одной сущности,
    // и хочет выбрать существующую сущность для привязки этого тега)
    if (cleanSearchQuery.value) {
      let list = allEntities.value;
      if (activeTypeFilter.value !== 'all') {
        list = list.filter(e => e.entity_type === activeTypeFilter.value);
      }
      return list;
    }
    return [];
  });

  const showQuickCreate = computed(() => {
    const q = cleanSearchQuery.value;
    if (!q || isCreating.value) return false;
    const lowerQ = q.toLowerCase();
    const exists = allEntities.value.some(e => e.name.toLowerCase() === lowerQ);
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
    if (!entity) return;
    const q = cleanSearchQuery.value;
    if (q && props.project) {
      const isExactMatch = entity.name.toLowerCase() === q.toLowerCase() ||
        (entity.cleanTags || []).some(t => t.toLowerCase() === q.toLowerCase()) ||
        (entity.aliases || []).some((a: string) => a.toLowerCase() === q.toLowerCase());
      if (!isExactMatch) {
        const nextTags = Array.from(new Set([...(entity.cleanTags || []), q]));
        const currentAttrs = (entity as { attributes?: Record<string, unknown> }).attributes || {};
        const nextAttrs = {
          ...currentAttrs,
          tags: nextTags
        };
        void api.saveEntity(props.project, {
          ...entity,
          tags: nextTags,
          attributes: nextAttrs
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
    const name = cleanSearchQuery.value;
    if (!name || isCreating.value) return;

    // Выбираем тип: переданный, либо активный фильтр, либо первый доступный из доступных типов
    const chosenType = typeKey || (activeTypeFilter.value !== 'all' ? activeTypeFilter.value : availableCreationTypes.value[0]?.id || 'character');

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
    cleanSearchQuery,
    activeTypeFilter,
    selectedIndex,
    searchInput,
    listEl,
    isCreating,
    entityTypes,
    availableCreationTypes,
    filteredEntities,
    isFallbackList,
    showQuickCreate,
    moveSelection,
    selectCurrent,
    selectEntity,
    quickCreateEntity,
    setTypeFilter,
    close
  };
}
