import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  ALL_TOOL_CATEGORIES,
  MODE_CATEGORIES_MAP,
  type AutoApproveState,
  type AiAutoApproveModalProps,
  type AiAutoApproveModalEmits,
  type ToolCategoryInfo
} from './AiAutoApproveModal.model';

const DEFAULT_STATE: AutoApproveState = {
  enabled: true,
  categories: {
    read: true,
    write: false,
    delete: false,
    timeline: true,
    audit: true,
    delegate: false
  }
};

export function useAiAutoApproveModal(
  props: AiAutoApproveModalProps,
  emit: AiAutoApproveModalEmits
) {
  const isOpen = ref(false);
  const containerRef = ref<HTMLElement | null>(null);

  const storageKey = computed(() => `worldwiki_ai_auto_approve_${props.currentProject || 'global'}`);

  const loadState = (): AutoApproveState => {
    try {
      const raw = localStorage.getItem(storageKey.value);
      if (raw) {
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Failed to parse auto approve state:', e);
    }
    return { ...DEFAULT_STATE };
  };

  const state = ref<AutoApproveState>(loadState());

  watch(storageKey, () => {
    state.value = loadState();
  });

  watch(state, (val) => {
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(val));
    } catch (e) {
      console.error('Failed to save auto approve state:', e);
    }
    emit('update:state', val);
  }, { deep: true });

  const availableCategories = computed<ToolCategoryInfo[]>(() => {
    const rawMode = (props.activeModeSlug || 'companion').toLowerCase();
    const allowedKeys = MODE_CATEGORIES_MAP[rawMode] || MODE_CATEGORIES_MAP.companion;
    return ALL_TOOL_CATEGORIES.filter((cat) => allowedKeys.includes(cat.key));
  });

  const activeCount = computed(() => {
    if (!state.value.enabled) return 0;
    const cats = state.value.categories;
    const allowedKeys = availableCategories.value.map((c) => c.key);
    return allowedKeys.filter((k) => cats[k]).length;
  });

  const badgeText = computed(() => {
    const total = availableCategories.value.length;
    if (!state.value.enabled || activeCount.value === 0) {
      return 'Спрашивать всегда';
    }
    if (activeCount.value === total) {
      return '✓ Все разрешены';
    }
    return `✓ ${activeCount.value}/${total} разрешено`;
  });

  const toggleCategory = (key: keyof AutoApproveState['categories']) => {
    state.value.categories[key] = !state.value.categories[key];
    if (!state.value.enabled) {
      state.value.enabled = true;
    }
  };

  const setAll = () => {
    state.value.enabled = true;
    for (const cat of availableCategories.value) {
      state.value.categories[cat.key] = true;
    }
  };

  const setNone = () => {
    for (const cat of availableCategories.value) {
      state.value.categories[cat.key] = false;
    }
  };

  const toggleMaster = () => {
    state.value.enabled = !state.value.enabled;
  };

  const toggleModal = () => {
    isOpen.value = !isOpen.value;
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
      isOpen.value = false;
    }
  };

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  return {
    isOpen,
    containerRef,
    state,
    availableCategories,
    activeCount,
    badgeText,
    toggleCategory,
    setAll,
    setNone,
    toggleMaster,
    toggleModal
  };
}

