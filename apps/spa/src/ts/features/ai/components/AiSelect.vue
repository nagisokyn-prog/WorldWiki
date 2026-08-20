<template>
  <div ref="containerRef" class="ai-select-container">
    <div 
      class="ai-select-trigger input-base" 
      :class="{ 'is-open': isOpen }" 
    >
      <input 
        v-model="searchQuery" 
        type="text" 
        :placeholder="placeholder"
        class="combobox-input"
        @focus="openDropdown"
        @keydown.enter.prevent="handleEnter"
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

<style scoped src="@worldwiki/resources/styles/features/ai/AiSelect.css"></style>
