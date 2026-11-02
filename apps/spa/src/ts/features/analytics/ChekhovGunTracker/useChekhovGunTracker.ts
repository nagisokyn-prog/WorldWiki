import { ref, computed, onMounted, toValue, type MaybeRef } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useChapterStore } from '@/stores/chapter.store';
import { plotApi } from '@/services/api/plot.api';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type {
  TrackedItem,
  GunTrackerFilterState,
  GunTrackerScope,
  ItemJourneyReport,
  ItemJourneyNode,
  LocatePromisePayload,
  ChekhovGunTrackerProps,
} from './ChekhovGunTracker.model';

export function isGunItem(item: TrackedItem): boolean {
  return (
    item.id.startsWith('plot_promises:') ||
    item.item_type === 'Чеховское ружьё' ||
    item.item_type === 'Предзнаменование'
  );
}

export function buildGunJourneyReport(
  item: TrackedItem,
  promise: PlotPromise | null,
  chapters: Array<{ id: string | unknown; title?: string; sort_order?: number | bigint | null }> = []
): ItemJourneyReport {
  const getChapterInfo = (chId?: string | null): { title: string; order: number } | null => {
    if (!chId) return null;
    const cleanCid = chId.replace(/^chapters:/, '');
    const found = chapters.find((c) => {
      const cid = typeof c.id === 'string' ? c.id : String(c.id);
      return cid === chId || cid === cleanCid || cid.replace(/^chapters:/, '') === cleanCid;
    });
    if (!found) return null;
    const rawOrder = found.sort_order;
    const order = typeof rawOrder === 'bigint' ? Number(rawOrder) : (rawOrder ?? 0);
    return {
      title: found.title || `Глава ${order}`,
      order,
    };
  };

  const nodes: ItemJourneyNode[] = [];
  const firstMilestone = promise?.milestones?.[0];

  if (promise && Array.isArray(promise.milestones) && promise.milestones.length > 0) {
    promise.milestones.forEach((m, idx) => {
      const chInfo = getChapterInfo(m.chapter_id);
      let nodeType = 'scene';
      let title = '🌿 Развитие сюжета';
      if (m.stage === 'plant' || idx === 0) {
        nodeType = 'creation';
        title = '🌱 Завязка (Посадка ружья)';
      } else if (m.stage === 'resolution') {
        nodeType = 'destruction';
        title = '🎯 Выстрел (Развязка)';
      }

      nodes.push({
        id: m.milestone_id || `${item.id}_milestone_${idx}`,
        title,
        node_type: nodeType,
        chapter_id: m.chapter_id,
        chapter_title: chInfo?.title || (m.chapter_id ? 'Глава' : undefined),
        chapter_order: chInfo?.order,
        owner_name: item.current_owner_name,
        description: m.quote || m.note || item.name,
        quote: m.quote || m.note || item.name,
        block_id: m.block_id || null,
        paragraph_index: m.order_index ?? null,
      });
    });
  } else {
    const plantChapterId =
      rich?.chapter_id ||
      firstMilestone?.chapter_id ||
      (item.custody_chain?.[0]?.chapter_id ?? null);
    const plantChInfo = getChapterInfo(plantChapterId);

    const plantTitle =
      item.custody_chain?.[0]?.chapter_title ||
      plantChInfo?.title ||
      (item.first_chapter_order !== null && item.first_chapter_order !== undefined
        ? `Глава ${item.first_chapter_order}`
        : undefined);

    nodes.push({
      id: `${item.id}_plant`,
      title: '🌱 Завязка (Посадка ружья)',
      node_type: 'creation',
      chapter_id: plantChapterId,
      chapter_title: plantTitle,
      chapter_order: plantChInfo?.order ?? item.first_chapter_order ?? 0,
      owner_name: item.current_owner_name,
      description: promise?.title || item.name,
      quote: rich?.quote || promise?.title || item.name,
      block_id: rich?.block_id || firstMilestone?.block_id || null,
      paragraph_index: rich?.paragraph_index ?? firstMilestone?.order_index ?? 0,
    });

    const isResolved =
      item.status_category.includes('Выстрел') ||
      promise?.status === 'resolved' ||
      promise?.status === 'fired';
    const isBroken =
      item.status_category.includes('Сорвано') ||
      promise?.status === 'broken';

    if (isResolved || isBroken) {
      nodes.push({
        id: `${item.id}_resolution`,
        title: isBroken ? '💥 Срыв ружья' : '🎯 Выстрел (Развязка)',
        node_type: 'destruction',
        chapter_id: plantChapterId,
        chapter_title: plantTitle,
        chapter_order: plantChInfo?.order ?? item.last_chapter_order ?? 0,
        owner_name: item.current_owner_name,
        description: isBroken
          ? 'Обещание или предзнаменование снято или сорвано по ходу сюжета.'
          : 'Сюжетное ружьё успешно выстрелило — драматургическая линия завершена.',
      });
    }
  }

  return {
    item_id: item.id,
    item_name: promise?.title || item.name,
    item_type: item.item_type || 'Чеховское ружьё',
    status_category: item.status_category || 'Заряжено',
    nodes,
  };
}

export function useChekhovGunTracker(projectIdOrProps: MaybeRef<string> | ChekhovGunTrackerProps) {
  const store = useAnalyticsStore();
  const chapterStore = useChapterStore();
  const getProjectId = () => {
    const val = toValue(projectIdOrProps);
    if (typeof val === 'object' && val !== null) {
      return (val as ChekhovGunTrackerProps).projectId || (val as ChekhovGunTrackerProps).project || '';
    }
    return (val as string) || '';
  };

  const filter = ref<GunTrackerFilterState>({
    search: '',
    itemType: 'all',
    usageState: 'all',
    scope: 'guns',
  });

  const selectedItem = ref<TrackedItem | null>(null);
  const selectedJourney = ref<ItemJourneyReport | null>(null);
  const isJourneyModalOpen = ref(false);
  const isJourneyLoading = ref(false);

  const isLoading = computed(() => store.itemTrackerLoading);
  const rawItems = computed<TrackedItem[]>(() => store.itemTracker?.items ?? []);

  const gunsCount = computed(() => rawItems.value.filter(isGunItem).length);
  const itemsCount = computed(() => rawItems.value.filter((i) => !isGunItem(i)).length);
  const totalCount = computed(() => rawItems.value.length);

  // Фильтрация элементов по выбранному срезу: ружья / артефакты / всё
  const scopedItems = computed<TrackedItem[]>(() => {
    if (filter.value.scope === 'guns') {
      return rawItems.value.filter(isGunItem);
    }
    if (filter.value.scope === 'items') {
      return rawItems.value.filter((i) => !isGunItem(i));
    }
    return rawItems.value;
  });

  // Динамическая сводка по текущему срезу
  const summary = computed(() => {
    const list = scopedItems.value;
    return {
      total_items: list.length,
      active_count: list.filter((i) => i.usage_state === 'active').length,
      sleeping_count: list.filter((i) => i.usage_state === 'sleeping').length,
      forgotten_count: list.filter((i) => i.usage_state === 'forgotten').length,
      destroyed_count: list.filter((i) => i.usage_state === 'destroyed_or_lost').length,
    };
  });

  // Доступные категории предметов внутри текущего среза
  const itemTypes = computed(() => {
    const types = new Set<string>();
    for (const it of scopedItems.value) {
      if (it.item_type) types.add(it.item_type);
    }
    return Array.from(types);
  });

  // Отфильтрованные элементы (поиск, тип, статус использования)
  const filteredItems = computed(() => {
    const q = filter.value.search.trim().toLowerCase();
    const typeFilter = filter.value.itemType;
    const stateFilter = filter.value.usageState;

    return scopedItems.value.filter((item) => {
      // 1. Поиск по тексту
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesOwner = (item.current_owner_name ?? '').toLowerCase().includes(q);
        const matchesType = item.item_type.toLowerCase().includes(q);
        if (!matchesName && !matchesOwner && !matchesType) return false;
      }

      // 2. Тип предмета
      if (typeFilter !== 'all' && item.item_type !== typeFilter) {
        return false;
      }

      // 3. Статус
      if (stateFilter !== 'all') {
        if (stateFilter === 'active' && item.usage_state !== 'active') return false;
        if (stateFilter === 'sleeping' && item.usage_state !== 'sleeping') return false;
        if (stateFilter === 'forgotten' && item.usage_state !== 'forgotten') return false;
        if (stateFilter === 'destroyed' && item.usage_state !== 'destroyed_or_lost') return false;
      }

      return true;
    });
  });

  const activeItems = computed(() =>
    filteredItems.value.filter((i) => i.usage_state === 'active')
  );

  const sleepingItems = computed(() =>
    filteredItems.value.filter((i) => i.usage_state === 'sleeping')
  );

  const forgottenItems = computed(() =>
    filteredItems.value.filter((i) => i.usage_state === 'forgotten')
  );

  const destroyedItems = computed(() =>
    filteredItems.value.filter((i) => i.usage_state === 'destroyed_or_lost')
  );

  async function loadData(force = false) {
    const pId = getProjectId();
    if (!pId) return;
    await store.loadItemTracker(pId, force);
  }

  async function openJourney(item: TrackedItem) {
    const pId = getProjectId();
    if (!pId) return;
    selectedItem.value = item;
    selectedJourney.value = null;
    isJourneyModalOpen.value = true;
    isJourneyLoading.value = true;
    try {
      if (isGunItem(item)) {
        let promise: PlotPromise | null = null;
        try {
          promise = await plotApi.getPlotPromise(item.id);
        } catch (e: unknown) {
          console.warn('[ChekhovGunTracker] Could not load plot promise details:', e);
        }
        const chapters = chapterStore?.hierarchy?.chapters ?? [];
        selectedJourney.value = buildGunJourneyReport(item, promise, chapters);
      } else {
        const journey = await store.loadItemJourney(pId, item.id);
        selectedJourney.value = journey;
      }
    } finally {
      isJourneyLoading.value = false;
    }
  }

  function closeJourneyModal() {
    isJourneyModalOpen.value = false;
    selectedJourney.value = null;
    selectedItem.value = null;
  }

  function handleLocateNode(payload: LocatePromisePayload) {
    closeJourneyModal();

    const dispatch = () => {
      document.dispatchEvent(
        new CustomEvent('ww:locate-promise', {
          detail: payload,
        })
      );
    };

    dispatch();
    setTimeout(dispatch, 250);
    setTimeout(dispatch, 500);
    setTimeout(dispatch, 800);
  }

  function setScope(scope: GunTrackerScope) {
    filter.value.scope = scope;
    filter.value.itemType = 'all';
  }

  function resetFilter() {
    filter.value.search = '';
    filter.value.itemType = 'all';
    filter.value.usageState = 'all';
  }

  onMounted(() => {
    loadData();
  });

  return {
    filter,
    summary,
    isLoading,
    gunsCount,
    itemsCount,
    totalCount,
    itemTypes,
    filteredItems,
    activeItems,
    sleepingItems,
    forgottenItems,
    destroyedItems,
    selectedItem,
    selectedJourney,
    isJourneyModalOpen,
    isJourneyLoading,
    loadData,
    openJourney,
    closeJourneyModal,
    handleLocateNode,
    setScope,
    resetFilter,
  };
}
