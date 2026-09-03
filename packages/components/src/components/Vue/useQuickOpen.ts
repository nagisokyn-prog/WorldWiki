import { ref, watch, nextTick, computed } from 'vue';

export interface QOItem {
  id: string;
  rawId: string;
  title: string;
  typeLabel: string;
  entityType: string;
  emoji: string;
  data?: unknown;
}

export interface QuickOpenProps {
  dataSource: () => Promise<QOItem[]>;
  placeholder?: string;
}

export interface QuickOpenEmits {
  (e: 'select', item: QOItem): void;
}

export function useQuickOpen(
  props: QuickOpenProps,
  emit: QuickOpenEmits
) {
  const isOpen = ref(false);
  const query = ref('');
  const loading = ref(false);
  const activeIdx = ref(0);
  const inputRef = ref<HTMLInputElement | null>(null);
  const resultsRef = ref<HTMLElement | null>(null);
  const allItems = ref<QOItem[]>([]);
  const placeholder = props.placeholder ?? 'Type to search...';

  const filtered = computed(() => {
    if (!query.value.trim()) return [];
    const q = query.value.toLowerCase();
    return allItems.value.filter(i => i.title.toLowerCase().includes(q));
  });

  const loadAll = async () => {
    if (allItems.value.length > 0) return;
    loading.value = true;
    try {
      allItems.value = await props.dataSource();
    } catch (e) {
      console.error('[QuickOpen] dataSource error:', e);
    }
    loading.value = false;
  };

  watch(() => props.dataSource, () => {
    allItems.value = [];
  });

  const scrollToActive = () => {
    void nextTick(() => {
      resultsRef.value?.querySelectorAll('.qo-item')[activeIdx.value]?.scrollIntoView({ block: 'nearest' });
    });
  };

  const open = async () => {
    isOpen.value = true;
    query.value = '';
    activeIdx.value = 0;
    await loadAll();
    await nextTick();
    inputRef.value?.focus();
  };

  const close = () => {
    isOpen.value = false;
  };

  const moveDown = () => {
    activeIdx.value = Math.min(activeIdx.value + 1, Math.min(filtered.value.length - 1, 19));
    scrollToActive();
  };

  const moveUp = () => {
    activeIdx.value = Math.max(activeIdx.value - 1, 0);
    scrollToActive();
  };

  const select = (item: QOItem) => {
    close();
    emit('select', item);
  };

  const selectActive = () => {
    const item = filtered.value[activeIdx.value];
    if (item) select(item);
  };

  const invalidate = () => {
    allItems.value = [];
  };

  watch(query, () => {
    activeIdx.value = 0;
  });

  return {
    isOpen,
    query,
    loading,
    activeIdx,
    inputRef,
    resultsRef,
    placeholder,
    filtered,
    open,
    close,
    moveDown,
    moveUp,
    select,
    selectActive,
    invalidate
  };
}
