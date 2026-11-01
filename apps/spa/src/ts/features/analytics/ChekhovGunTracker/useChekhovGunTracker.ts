import { ref, computed, onMounted, toValue, type MaybeRef } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics.store';
import type {
  TrackedItem,
  GunTrackerFilterState,
  ItemJourneyReport,
} from './ChekhovGunTracker.model';

export function useChekhovGunTracker(projectIdRef: MaybeRef<string>) {
  const store = useAnalyticsStore();
  const getProjectId = () => toValue(projectIdRef);

  const filter = ref<GunTrackerFilterState>({
    search: '',
    itemType: 'all',
    usageState: 'all',
  });

  const selectedJourney = ref<ItemJourneyReport | null>(null);
  const isJourneyModalOpen = ref(false);
  const isJourneyLoading = ref(false);

  const isLoading = computed(() => store.itemTrackerLoading);
  const summary = computed(() => store.itemTracker?.summary ?? {
    total_items: 0,
    active_count: 0,
    sleeping_count: 0,
    forgotten_count: 0,
    destroyed_count: 0,
  });

  const rawItems = computed<TrackedItem[]>(() => store.itemTracker?.items ?? []);

  // Available item types for dropdown filter
  const itemTypes = computed(() => {
    const types = new Set<string>();
    for (const it of rawItems.value) {
      if (it.item_type) types.add(it.item_type);
    }
    return Array.from(types);
  });

  // Filtered items
  const filteredItems = computed(() => {
    const q = filter.value.search.trim().toLowerCase();
    const typeFilter = filter.value.itemType;
    const stateFilter = filter.value.usageState;

    return rawItems.value.filter((item) => {
      // 1. Search text
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesOwner = (item.current_owner_name ?? '').toLowerCase().includes(q);
        const matchesType = item.item_type.toLowerCase().includes(q);
        if (!matchesName && !matchesOwner && !matchesType) return false;
      }

      // 2. Item type
      if (typeFilter !== 'all' && item.item_type !== typeFilter) {
        return false;
      }

      // 3. Usage state
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
    selectedJourney.value = null;
    isJourneyModalOpen.value = true;
    isJourneyLoading.value = true;
    try {
      const journey = await store.loadItemJourney(pId, item.id);
      selectedJourney.value = journey;
    } finally {
      isJourneyLoading.value = false;
    }
  }

  function closeJourneyModal() {
    isJourneyModalOpen.value = false;
    selectedJourney.value = null;
  }

  function resetFilter() {
    filter.value = {
      search: '',
      itemType: 'all',
      usageState: 'all',
    };
  }

  onMounted(() => {
    loadData();
  });

  return {
    filter,
    summary,
    isLoading,
    itemTypes,
    filteredItems,
    activeItems,
    sleepingItems,
    forgottenItems,
    destroyedItems,
    selectedJourney,
    isJourneyModalOpen,
    isJourneyLoading,
    loadData,
    openJourney,
    closeJourneyModal,
    resetFilter,
  };
}
