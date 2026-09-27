import { ref, computed, watch, onMounted } from 'vue';
import { getCharacterJourney, getEntities } from '@/services/api.client';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import type { Entity } from '@/types/generated/Entity';
import type {
  CharacterJourneyData,
  JourneyTimelineItem,
  JourneyAppearance,
  JourneyEvent,
  JourneyRelation,
  JourneyPromise,
  CharacterJourneyViewMode,
  ArcGroup,
} from './CharacterJourney.model';

export function useCharacterJourney(projectId: string, initialEntityId?: string) {
  const storyArcsStore = useStoryArcsStore();
  const currentEntityId = ref<string>(initialEntityId || '');
  const data = ref<CharacterJourneyData | null>(null);
  const entitiesList = ref<Entity[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const viewMode = ref<CharacterJourneyViewMode>('BY_ARCS');
  const selectedArcFilter = ref<string>('ALL'); // 'ALL' | 'UNASSIGNED' | specific arc_id
  const filterType = ref<string>('all'); // 'all' | 'scenes' | 'events' | 'relations' | 'promises'

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
      console.log('[useCharacterJourney] Loading journey for entity:', currentEntityId.value, 'in project:', projectId);
      await storyArcsStore.loadArcs(projectId);
      const raw = await getCharacterJourney(projectId, currentEntityId.value);
      console.log('[useCharacterJourney] Received journey data:', raw);
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

  // 1. Все плоские элементы хронологии
  const allTimelineItems = computed<JourneyTimelineItem[]>(() => {
    if (!data.value) return [];
    const items: JourneyTimelineItem[] = [];

    // 1. Appearances in chapters
    data.value.appearances.forEach((app: JourneyAppearance) => {
      items.push({
        id: `app-${app.chapter_id}`,
        type: 'appearance',
        title: `Появление: ${app.chapter_title}`,
        subtitle: `Глава #${app.chapter_order} (${app.source === 'scene' ? 'Сцена' : 'Упоминание'})`,
        chapter_id: app.chapter_id,
        chapter_title: app.chapter_title,
        chapter_order: app.chapter_order,
        badge: app.source === 'scene' ? 'Сцена' : 'Упоминание',
        badgeType: app.source === 'scene' ? 'accent' : 'muted',
        description: app.role ? `Роль: ${app.role}` : undefined,
      });
    });

    // 2. Timeline Events (diegetic M_abs)
    data.value.events.forEach((ev: JourneyEvent) => {
      items.push({
        id: `ev-${ev.event_id}`,
        type: 'event',
        title: `Событие мира: ${ev.event_title}`,
        subtitle: `M_abs: ${ev.m_abs}`,
        m_abs: ev.m_abs,
        badge: 'Событие мира',
        badgeType: 'warning',
        description: ev.event_desc || (ev.role ? `Участие: ${ev.role}` : undefined),
      });
    });

    // 3. Relations
    data.value.relations.forEach((rel: JourneyRelation) => {
      items.push({
        id: `rel-${rel.id}`,
        type: 'relation_change',
        title: `Связь с «${rel.target_name}» (${rel.rel_type})`,
        subtitle: rel.start_order ? `С главы #${rel.start_order}` : 'С начала',
        chapter_order: rel.start_order,
        badge: `Сила: ${rel.strength ?? 0}`,
        badgeType: (rel.strength ?? 0) >= 0 ? 'success' : 'danger',
      });
    });

    // 4. Plot Promises with Arcs
    data.value.promises.forEach((p: JourneyPromise) => {
      const arc = p.arc_id ? storyArcsStore.arcs.find((a) => a.id === p.arc_id) : null;
      const arcTitle = p.arc_title || arc?.title;
      const arcColor = p.arc_color || arc?.color || undefined;

      items.push({
        id: `prom-${p.id}`,
        type: 'promise',
        title: `Сюжетный блок (${p.kind}): «${p.quote.slice(0, 60)}${p.quote.length > 60 ? '...' : ''}»`,
        subtitle: p.chapter_title
          ? `Глава: ${p.chapter_title} (№${p.planted_order ?? '?'})`
          : `Заложено в главе #${p.planted_order ?? '?'}`,
        chapter_id: p.chapter_id || undefined,
        chapter_title: p.chapter_title || undefined,
        chapter_order: p.planted_order,
        paragraph_index: p.paragraph_index,
        block_id: p.block_id || undefined,
        arc_id: p.arc_id || undefined,
        arc_title: arcTitle,
        arc_color: arcColor,
        arc_phase: p.arc_phase || undefined,
        badge: p.status === 'resolved' ? 'Разрешено' : 'Активно',
        badgeType: p.status === 'resolved' ? 'success' : 'accent',
        description: p.arc_phase ? `Фаза арки: ${p.arc_phase}` : undefined,
      });
    });

    return items;
  });

  // 2. Отфильтрованные элементы с детекцией флэшбеков
  const filteredTimelineItems = computed<JourneyTimelineItem[]>(() => {
    let items = allTimelineItems.value.filter((item) => {
      // Фильтр по типу
      if (filterType.value === 'scenes' && item.type !== 'appearance' && item.type !== 'promise') return false;
      if (filterType.value === 'events' && item.type !== 'event') return false;
      if (filterType.value === 'relations' && item.type !== 'relation_change') return false;
      if (filterType.value === 'promises' && item.type !== 'promise') return false;

      // Фильтр по арке
      if (selectedArcFilter.value !== 'ALL') {
        if (selectedArcFilter.value === 'UNASSIGNED') {
          if (item.arc_id) return false;
        } else if (item.arc_id !== selectedArcFilter.value) {
          return false;
        }
      }

      return true;
    });

    // Сортировка в зависимости от viewMode
    if (viewMode.value === 'CHRONOLOGY') {
      items = [...items].sort((a, b) => {
        const mAbsA = a.m_abs ?? (a.chapter_order ? a.chapter_order * 1000 : 0);
        const mAbsB = b.m_abs ?? (b.chapter_order ? b.chapter_order * 1000 : 0);
        return mAbsA - mAbsB;
      });
    } else {
      // NARRATIVE или BY_ARCS: Сортировка по главам для читателя
      items = [...items].sort((a, b) => {
        const orderA = a.chapter_order ?? (a.m_abs ? Math.floor(a.m_abs / 1000) : 0);
        const orderB = b.chapter_order ?? (b.m_abs ? Math.floor(b.m_abs / 1000) : 0);
        return orderA - orderB;
      });
    }

    // Детекция флэшбеков (когда время m_abs идет вспять относительно порядка повествования)
    let lastSeenMabs: number | null = null;
    return items.map((item) => {
      let isFlashback = false;
      if (item.m_abs !== undefined && item.m_abs !== null) {
        if (lastSeenMabs !== null && item.m_abs < lastSeenMabs) {
          isFlashback = true;
        }
        lastSeenMabs = item.m_abs;
      }
      return {
        ...item,
        isFlashback,
      };
    });
  });

  // 3. Группировка по сюжетным аркам
  const arcGroups = computed<ArcGroup[]>(() => {
    const groupsMap = new Map<string, ArcGroup>();

    // Инициализируем зарегистрированные арки проекта
    storyArcsStore.arcs.forEach((arc) => {
      if (arc.id) {
        groupsMap.set(arc.id, {
          arcId: arc.id,
          arcTitle: arc.title,
          arcColor: arc.color || undefined,
          items: [],
        });
      }
    });

    // Специальная группа "Вне арок"
    const unassignedGroup: ArcGroup = {
      arcId: 'UNASSIGNED',
      arcTitle: '🌿 Вне сюжетных арок',
      arcColor: 'var(--text-muted)',
      items: [],
    };

    filteredTimelineItems.value.forEach((item) => {
      if (item.arc_id && groupsMap.has(item.arc_id)) {
        groupsMap.get(item.arc_id)!.items.push(item);
      } else if (item.arc_id) {
        // Арка есть в данных, но не в сторе
        if (!groupsMap.has(item.arc_id)) {
          groupsMap.set(item.arc_id, {
            arcId: item.arc_id,
            arcTitle: item.arc_title || 'Неизвестная арка',
            arcColor: item.arc_color || undefined,
            items: [],
          });
        }
        groupsMap.get(item.arc_id)!.items.push(item);
      } else {
        unassignedGroup.items.push(item);
      }
    });

    const result = Array.from(groupsMap.values()).filter((g) => g.items.length > 0);
    if (unassignedGroup.items.length > 0) {
      result.push(unassignedGroup);
    }
    return result;
  });

  // Переключение персонажа
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
    entitiesList,
    isLoading,
    error,
    viewMode,
    selectedArcFilter,
    filterType,
    timelineItems: filteredTimelineItems,
    arcGroups,
    storyArcs: computed(() => storyArcsStore.arcs),
    selectEntity,
    refresh: loadJourney,
  };
}
