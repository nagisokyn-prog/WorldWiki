<template>
  <div class="context-selector-container">
    <button class="add-context-btn" :title="'Добавить контекст'" @click="toggleMenu">
      <i class="fas fa-plus"></i>
    </button>
    
    <div v-if="isOpen" class="context-menu">
      <div class="menu-header">
        <button v-if="level > 0" class="back-btn" @click="goBack">
          <i class="fas fa-arrow-left"></i>
        </button>
        <span>{{ getMenuTitle() }}</span>
        <button class="close-btn" @click="isOpen = false">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div v-if="level > 0" class="menu-search">
        <input v-model="searchQuery" type="text" class="input-base" placeholder="Поиск...">
      </div>
      
      <div class="menu-list">
        <!-- Level 0: Top Categories -->
        <template v-if="level === 0">
          <div class="menu-item" @click="selectCategory('volume')">
            <i class="fas fa-book"></i> Тома
            <i class="fas fa-chevron-right arrow"></i>
          </div>
          <div class="menu-item" @click="selectCategory('chapter')">
            <i class="fas fa-file-alt"></i> Главы
            <i class="fas fa-chevron-right arrow"></i>
          </div>
          <div class="menu-item" @click="selectCategory('entity')">
            <i class="fas fa-cube"></i> Сущности
            <i class="fas fa-chevron-right arrow"></i>
          </div>
        </template>

        <!-- Level 1: Subcategories (for Entity only right now) or Items -->
        <template v-else-if="level === 1">
          <template v-if="currentCategory === 'entity'">
            <!-- List entity types -->
            <div 
              v-for="type in filteredEntityTypes" 
              :key="type.key" 
              class="menu-item"
              @click="selectEntityType(type.key)"
            >
              {{ type.label }}
              <i class="fas fa-chevron-right arrow"></i>
            </div>
          </template>
          
          <template v-else>
            <!-- List Volumes or Chapters -->
            <div 
              v-for="item in filteredItems" 
              :key="item.id" 
              class="menu-item selectable"
              :class="{ selected: isSelected(item) }"
              @click="toggleItem(item)"
            >
              <div class="checkbox">
                <i v-if="isSelected(item)" class="fas fa-check"></i>
              </div>
              {{ item.title }}
            </div>
          </template>
        </template>

        <!-- Level 2: Entity Items -->
        <template v-else-if="level === 2">
          <div 
            v-for="item in filteredItems" 
            :key="item.id" 
            class="menu-item selectable"
            :class="{ selected: isSelected(item) }"
            @click="toggleItem(item)"
          >
            <div class="checkbox">
              <i v-if="isSelected(item)" class="fas fa-check"></i>
            </div>
            {{ item.title }}
          </div>
        </template>
        
        <div v-if="level > 0 && filteredItems.length === 0 && currentCategory !== 'entity'" class="empty-state">
          Ничего не найдено
        </div>
      </div>
      
      <div v-if="selectedContexts.length > 0" class="menu-footer">
        <button class="btn-primary full-width" @click="applySelection">
          Прикрепить ({{ selectedContexts.length }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  useAiContextSelector, 
  type AiContextSelectorProps, 
  type AiContextSelectorEmits,
  type ContextItem 
} from './useAiContextSelector';

export type { ContextItem };

const props = defineProps<AiContextSelectorProps>();
const emit = defineEmits<AiContextSelectorEmits>();

const {
  isOpen,
  level,
  currentCategory,
  searchQuery,
  selectedContexts,
  filteredEntityTypes,
  filteredItems,
  toggleMenu,
  goBack,
  getMenuTitle,
  selectCategory,
  selectEntityType,
  isSelected,
  toggleItem,
  applySelection
} = useAiContextSelector(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiContextSelector.css"></style>
