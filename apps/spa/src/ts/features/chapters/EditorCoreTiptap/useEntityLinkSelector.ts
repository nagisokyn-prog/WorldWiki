import { ref, computed, watch, nextTick } from 'vue';
import * as api from '../../../services/api.client';
import { invalidateCache } from '../../../utils/requestCache';
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
        ...extractCleanTags((r as Record<string, unknown>)['теги']),
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
        'теги': cleanTags,
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
    // возвращаем список всех сущностей (пользователь ввел тег, которого еще нет,
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

  // Остальные сущности категории, не вошедшие в matchingEntities при активном поиске
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

  const quickCreateName = computed(() => {
    return cleanSearchQuery.value || sourceMention.value;
  });

  const showQuickCreate = computed(() => {
    const q = quickCreateName.value;
    if (!q || isCreating.value) return false;
    const lowerQ = q.toLowerCase();
    const exists = allEntities.value.some(e => e.name.toLowerCase() === lowerQ);
    return !exists;
  });

  const totalItemsCount = computed(() => {
    return allSelectableEntities.value.length + (showQuickCreate.value ? 1 : 0);
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
        if (searchQuery.value) {
          searchInput.value?.select();
        }
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
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }
      }
    });
  };

  const selectCurrent = () => {
    if (selectedIndex.value < allSelectableEntities.value.length) {
      const entity = allSelectableEntities.value[selectedIndex.value];
      if (entity) {
        selectEntity(entity);
      }
    } else if (showQuickCreate.value) {
      void quickCreateEntity();
    }
  };

  const selectEntity = (entity: EntitySelectorItem) => {
    if (!entity) return;
    const targetTag = saveAsTag.value
      ? (sourceMention.value || cleanSearchQuery.value)
      : '';
    if (targetTag && props.project) {
      const tagLower = targetTag.toLowerCase();
      const existingTags = Array.isArray(entity.cleanTags) && entity.cleanTags.length > 0
        ? entity.cleanTags
        : Array.isArray(entity.tags) && entity.tags.length > 0
          ? entity.tags
          : Array.isArray((entity as Record<string, unknown>)['теги'])
            ? ((entity as Record<string, unknown>)['теги'] as string[])
            : [];
      const isExactMatch = entity.name.toLowerCase() === tagLower ||
        existingTags.some(t => t.toLowerCase() === tagLower) ||
        (entity.aliases || []).some((a: string) => a.toLowerCase() === tagLower);
      if (!isExactMatch) {
        const nextTags = Array.from(new Set([...existingTags, targetTag]));
        const currentAttrs = (entity as { attributes?: Record<string, unknown> }).attributes || {};
        const currentAliases = Array.isArray(currentAttrs.aliases)
          ? (currentAttrs.aliases as string[])
          : Array.isArray(currentAttrs['псевдонимы'])
            ? (currentAttrs['псевдонимы'] as string[])
            : [];
        const nextAliases = Array.from(new Set([...currentAliases, targetTag]));
        const nextAttrs = {
          ...currentAttrs,
          'название': currentAttrs['название'] || entity.name,
          tags: nextTags,
          'теги': nextTags,
          aliases: nextAliases,
          'псевдонимы': nextAliases
        };
        void api.saveEntity(props.project, {
          ...entity,
          tags: nextTags,
          'теги': nextTags,
          attributes: nextAttrs
        } as never).then(() => {
          invalidateCache('entities:');
          invalidateCache('tags:');
          document.dispatchEvent(new CustomEvent('ww:tags-updated', { detail: { project: props.project, entityId: entity.id, tags: nextTags } }));
        }).catch((e: unknown) => console.warn('[useEntityLinkSelector] Auto-tagging warning:', e));

        entity.cleanTags = nextTags;
        entity.tags = nextTags;
        (entity as Record<string, unknown>)['теги'] = nextTags;
        entity.aliases = nextAliases;
        (entity as Record<string, unknown>)['псевдонимы'] = nextAliases;
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
    const name = quickCreateName.value;
    if (!name || isCreating.value) return;

    // Выбираем тип: переданный, либо активный фильтр, либо первый доступный из доступных типов
    const chosenType = typeKey || (activeTypeFilter.value !== 'all' ? activeTypeFilter.value : availableCreationTypes.value[0]?.id || 'character');

    isCreating.value = true;
    try {
      const schema = loadedSchemas.value.find(s => s.type_key === chosenType);
      const fullSchema = schema?.full_schema as Record<string, unknown> | undefined;
      const firstSection = (fullSchema?.sections as Array<{ fields?: Array<{ path?: string; id?: string; class?: string }> }>)?.[0];
      const firstField = firstSection?.fields?.[0];
      const firstFieldPath = firstField?.path || firstField?.id || firstField?.class || (fullSchema?.titleField as string) || 'название';

      const initialTags: string[] = [];
      const initialAliases: string[] = [];
      if (saveAsTag.value && sourceMention.value && sourceMention.value.toLowerCase() !== name.toLowerCase()) {
        initialTags.push(sourceMention.value);
        initialAliases.push(sourceMention.value);
      }

      const attributes: Record<string, unknown> = {
        name,
        'теги': initialTags,
        tags: initialTags,
        aliases: initialAliases,
        'псевдонимы': initialAliases,
        [firstFieldPath]: name
      };

      const payload: Record<string, unknown> = {
        name,
        entity_type: chosenType,
        attributes,
        tags: initialTags,
        'теги': initialTags
      };
      const created = await api.saveEntity(props.project, payload as never);
      invalidateCache('entities:');
      invalidateCache('tags:');
      const newId = String(created.id || '');
      document.dispatchEvent(new CustomEvent('ww:entity-saved', { detail: { type: chosenType, id: newId } }));
      if (initialTags.length > 0) {
        document.dispatchEvent(new CustomEvent('ww:tags-updated', { detail: { project: props.project, entityId: newId, tags: initialTags } }));
      }
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

