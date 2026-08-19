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
          <div class="menu-item" @click="selectCategory('arc')">
            <i class="fas fa-bookmark"></i> Арки
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
            <!-- List Volumes, Arcs, or Chapters -->
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
import { ref, computed } from 'vue';

const emit = defineEmits(['context-selected']);

const isOpen = ref(false);
const level = ref(0);
const currentCategory = ref('');
const currentEntityType = ref('');
const searchQuery = ref('');

export interface ContextItem {
  id: string;
  title: string;
  type: string;
  [key: string]: unknown;
}

// Example selected items
const selectedContexts = ref<ContextItem[]>([]);

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    level.value = 0;
    searchQuery.value = '';
    currentCategory.value = '';
  }
};

const goBack = () => {
  if (level.value > 0) {
    level.value--;
    searchQuery.value = '';
  }
};

const getMenuTitle = () => {
  if (level.value === 0) return 'Добавить контекст';
  if (level.value === 1) {
    if (currentCategory.value === 'volume') return 'Тома';
    if (currentCategory.value === 'arc') return 'Арки';
    if (currentCategory.value === 'chapter') return 'Главы';
    if (currentCategory.value === 'entity') return 'Типы сущностей';
  }
  if (level.value === 2) return 'Выберите сущности';
  return '';
};

const selectCategory = (cat: string) => {
  currentCategory.value = cat;
  level.value = 1;
};

const selectEntityType = (type: string) => {
  currentEntityType.value = type;
  level.value = 2;
};

// MOCK DATA
const entityTypes = [
  { key: 'character', label: 'Персонаж' },
  { key: 'location', label: 'Локация' },
  { key: 'organization', label: 'Организация' }
];

const mockItems: ContextItem[] = [
  { id: '1', title: 'Гарри Поттер', type: 'character' },
  { id: '2', title: 'Хогвартс', type: 'location' },
  { id: '3', title: 'Том 1: Философский камень', type: 'volume' },
  { id: '4', title: 'Глава 1: Мальчик, который выжил', type: 'chapter' }
];

const filteredEntityTypes = computed(() => {
  return entityTypes.filter(t => t.label.toLowerCase().includes(searchQuery.value.toLowerCase()));
});

const filteredItems = computed(() => {
  let items = mockItems.filter(i => {
    if (currentCategory.value === 'entity') {
      return i.type === currentEntityType.value;
    }
    return i.type === currentCategory.value;
  });
  
  if (searchQuery.value) {
    items = items.filter(i => i.title.toLowerCase().includes(searchQuery.value.toLowerCase()));
  }
  
  return items;
});

const isSelected = (item: ContextItem) => {
  return selectedContexts.value.some(i => i.id === item.id);
};

const toggleItem = (item: ContextItem) => {
  if (isSelected(item)) {
    selectedContexts.value = selectedContexts.value.filter(i => i.id !== item.id);
  } else {
    selectedContexts.value.push(item);
  }
};

const applySelection = () => {
  emit('context-selected', selectedContexts.value);
  selectedContexts.value = [];
  isOpen.value = false;
};
</script>

<style scoped>
.context-selector-container {
  position: relative;
}

.add-context-btn {
  background: none;
  border: 1px dashed var(--border-color);
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.add-context-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(139, 92, 246, 0.1);
}

.context-menu {
  position: absolute;
  bottom: 40px;
  left: 0;
  width: 250px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;
  max-height: 400px;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 500;
}

.back-btn, .close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
}

.back-btn:hover, .close-btn:hover {
  color: var(--text-main);
}

.menu-search {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.input-base {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
}

.menu-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.menu-item {
  padding: 10px 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
  color: var(--text-main);
}

.menu-item:hover {
  background: var(--bg-surface);
}

.menu-item i {
  margin-right: 10px;
  color: var(--text-muted);
}

.menu-item .arrow {
  margin-right: 0;
  margin-left: auto;
  font-size: 10px;
}

.menu-item.selectable {
  gap: 10px;
}

.menu-item.selectable i {
  margin: 0;
}

.checkbox {
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-item.selected .checkbox {
  background: var(--accent);
  border-color: var(--accent);
}

.menu-item.selected .checkbox i {
  color: white;
  font-size: 10px;
}

.menu-footer {
  padding: 10px;
  border-top: 1px solid var(--border-color);
}

.btn-primary.full-width {
  width: 100%;
  background: var(--accent);
  color: white;
  border: none;
  padding: 8px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary.full-width:hover {
  background: var(--accent-hover);
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
