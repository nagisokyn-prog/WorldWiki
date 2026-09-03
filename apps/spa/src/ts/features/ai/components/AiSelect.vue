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
import { 
  useAiSelect, 
  type AiSelectProps, 
  type AiSelectEmits,
  type AiSelectOption 
} from './useAiSelect';

export type { AiSelectOption };

const props = defineProps<AiSelectProps>();
const emit = defineEmits<AiSelectEmits>();

const {
  isOpen,
  searchQuery,
  containerRef,
  filteredOptions,
  openDropdown,
  toggleOpen,
  selectOption,
  handleEnter
} = useAiSelect(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSelect.css"></style>
