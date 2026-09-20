import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

export interface AiSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface AiSelectProps {
  modelValue: string;
  options: AiSelectOption[];
  placeholder?: string;
  allowCustom?: boolean;
}

export interface AiSelectEmits {
  (e: 'update:modelValue', value: string): void;
}

export function useAiSelect(
  props: AiSelectProps,
  emit: AiSelectEmits
) {
  const isOpen = ref(false);
  const searchQuery = ref(props.modelValue || '');
  const containerRef = ref<HTMLElement | null>(null);

  watch(() => props.modelValue, (newVal) => {
    if (newVal !== searchQuery.value) {
      searchQuery.value = newVal || '';
    }
  });

  const openDropdown = () => {
    isOpen.value = true;
  };

  const toggleOpen = () => {
    isOpen.value = !isOpen.value;
  };

  const selectOption = (opt: AiSelectOption) => {
    searchQuery.value = opt.value;
    emit('update:modelValue', opt.value);
    isOpen.value = false;
  };

  const filteredOptions = computed(() => {
    if (!searchQuery.value || searchQuery.value === props.modelValue) {
      return props.options;
    }
    const q = searchQuery.value.toLowerCase();
    return props.options.filter(o => 
      o.label.toLowerCase().includes(q) || 
      (o.description && o.description.toLowerCase().includes(q)) ||
      o.value.toLowerCase().includes(q)
    );
  });

  const handleEnter = () => {
    if (props.allowCustom && searchQuery.value) {
      emit('update:modelValue', searchQuery.value);
      isOpen.value = false;
    } else if (filteredOptions.value.length > 0) {
      selectOption(filteredOptions.value[0]);
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
      if (isOpen.value && props.allowCustom && searchQuery.value && searchQuery.value !== props.modelValue) {
        emit('update:modelValue', searchQuery.value);
      }
      isOpen.value = false;
    }
  };

  onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
  });

  return {
    isOpen,
    searchQuery,
    containerRef,
    filteredOptions,
    openDropdown,
    toggleOpen,
    selectOption,
    handleEnter
  };
}
