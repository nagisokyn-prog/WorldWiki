<template>
  <div class="ai-select-container" ref="containerRef">
    <div 
      class="ai-select-trigger input-base" 
      :class="{ 'is-open': isOpen }" 
    >
      <input 
        type="text" 
        v-model="searchQuery" 
        :placeholder="placeholder"
        @focus="openDropdown"
        @keydown.enter.prevent="handleEnter"
        class="combobox-input"
      />
      <i class="fas fa-chevron-down toggle-icon" @click="toggleOpen"></i>
    </div>

    <div v-if="isOpen" class="ai-select-dropdown">
      <div class="options-list">
        <div 
          v-for="option in filteredOptions" 
          :key="option.value"
          class="option-item"
          :class="{ selected: option.value === modelValue }"
          @click="selectOption(option)"
        >
          <div class="option-label">{{ option.label }}</div>
          <div v-if="option.description" class="option-desc">{{ option.description }}</div>
        </div>
        <div v-if="filteredOptions.length === 0" class="no-options">
          <span v-if="allowCustom && searchQuery">Нажмите Enter для использования "{{ searchQuery }}"</span>
          <span v-else>Ничего не найдено</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

interface Option {
  value: string;
  label: string;
  description?: string;
}

const props = defineProps<{
  modelValue: string;
  options: Option[];
  placeholder?: string;
  allowCustom?: boolean;
}>();

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const searchQuery = ref(props.modelValue || '');
const containerRef = ref<HTMLElement | null>(null);

// Sync external changes to internal search query
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

const selectOption = (opt: Option) => {
  searchQuery.value = opt.value;
  emit('update:modelValue', opt.value);
  isOpen.value = false;
};

const handleEnter = () => {
  if (props.allowCustom && searchQuery.value) {
    emit('update:modelValue', searchQuery.value);
    isOpen.value = false;
  } else if (filteredOptions.value.length > 0) {
    selectOption(filteredOptions.value[0]);
  }
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
</script>

<style scoped>
.ai-select-container {
  position: relative;
  width: 100%;
}

.ai-select-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
}

.combobox-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-main);
  font-size: 13px;
  outline: none;
  padding: 8px 0;
  width: 100%;
}

.combobox-input::placeholder {
  color: var(--text-muted);
}

.toggle-icon {
  color: var(--text-muted);
  font-size: 10px;
  transition: transform 0.2s;
  cursor: pointer;
  padding-left: 8px;
}

.is-open .toggle-icon {
  transform: rotate(180deg);
}

.ai-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-main);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.8);
  z-index: 1000;
  max-height: 250px;
  overflow-y: auto;
}

.options-list {
  display: flex;
  flex-direction: column;
}

.option-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid rgba(255,255,255,0.02);
}

.option-item:last-child {
  border-bottom: none;
}

.option-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.option-item.selected {
  background: rgba(139, 92, 246, 0.1);
}

.option-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
}

.option-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.no-options {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
}
</style>
