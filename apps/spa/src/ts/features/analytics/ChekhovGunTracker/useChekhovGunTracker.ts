import { ref, computed, onMounted, toValue, type MaybeRef } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useChapterStore } from '@/stores/chapter.store';
import { plotApi } from '@/services/api/plot.api';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/types/narrative';
import type {
  TrackedItem,
  GunTrackerFilterState,
  GunTrackerScope,
  ItemJourneyReport,
  ItemJourneyNode,
  LocatePromisePayload,
  ChekhovGunTrackerProps,
  ChekhovGunTrackerEmits,
} from './ChekhovGunTracker.model';
import { isGunItem, buildGunJourneyReport } from './chekhovGunTracker.utils';
export { isGunItem, buildGunJourneyReport };

export function useChekhovGunTracker(
  projectIdOrProps: MaybeRef<string> | ChekhovGunTrackerProps,
  emit?: ChekhovGunTrackerEmits
) {
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

  function onLocateNode(payload: LocatePromisePayload) {
    handleLocateNode(payload);
    emit?.('locate-promise', payload);
    emit?.('jump-to-chapter', payload.chapterId);
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
    onLocateNode,
    setScope,
    resetFilter,
  };
}
