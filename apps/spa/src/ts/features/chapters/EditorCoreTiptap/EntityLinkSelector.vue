<template>
  <div class="entity-link-selector-overlay" v-if="isOpen" @click.self="close">
    <div class="entity-link-selector-modal">
      <div class="selector-header">
        <h3>Вставка ссылки на сущность</h3>
        <button class="close-btn" @click="close">✕</button>
      </div>
      
      <div class="selector-body">
        <input 
          ref="searchInput"
          v-model="searchQuery"
          type="text" 
          :placeholder="step === 'type' ? 'Поиск типа сущности...' : 'Поиск сущности...'"
          class="selector-search"
          @keydown.down.prevent="moveSelection(1)"
          @keydown.up.prevent="moveSelection(-1)"
          @keydown.enter.prevent="selectCurrent"
          @keydown.esc.prevent="close"
        />

        <div class="selector-list" ref="listEl">
          <template v-if="step === 'type'">
            <div 
              v-for="(type, idx) in filteredTypes" 
              :key="type.id"
              class="selector-item"
              :class="{ active: selectedIndex === idx }"
              @click="selectType(type)"
              @mouseenter="selectedIndex = idx"
            >
              <span class="item-icon">{{ type.icon }}</span>
              <span class="item-name">{{ type.name }}</span>
            </div>
            <div v-if="filteredTypes.length === 0" class="selector-empty">
              Тип не найден
            </div>
          </template>

          <template v-else-if="step === 'entity'">
            <div class="back-btn" @click="step = 'type'; searchQuery = ''; selectedIndex = 0;">
              ← Назад к типам
            </div>
            <div 
              v-for="(entity, idx) in filteredEntities" 
              :key="entity.id"
              class="selector-item"
              :class="{ active: selectedIndex === idx }"
              @click="selectEntity(entity)"
              @mouseenter="selectedIndex = idx"
            >
              <span class="item-name">{{ entity.name }}</span>
              <span class="item-id">{{ entity.id.split(':').pop() }}</span>
            </div>
            <div v-if="filteredEntities.length === 0" class="selector-empty">
              Сущности не найдены
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import * as api from '../../../services/api.client';

const props = defineProps({
  project: { type: String, required: true },
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'insert']);

const step = ref<'type' | 'entity'>('type');
const searchQuery = ref('');
const selectedIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLElement | null>(null);

const loadedSchemas = ref<any[]>([]);
const selectedType = ref<any>(null);
const entitiesList = ref<any[]>([]);

const entityTypes = computed(() => {
  return loadedSchemas.value.map((s: any) => ({
    id: s.type_key,
    name: s.type_name,
    icon: s.icon || '📌'
  }));
});

const filteredTypes = computed(() => {
  if (!searchQuery.value) return entityTypes.value;
  const q = searchQuery.value.toLowerCase();
  return entityTypes.value.filter(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
});

const filteredEntities = computed(() => {
  if (!searchQuery.value) return entitiesList.value;
  const q = searchQuery.value.toLowerCase();
  return entitiesList.value.filter(e => 
    (e.name && e.name.toLowerCase().includes(q)) || 
    (e.id && String(e.id).toLowerCase().includes(q))
  );
});

watch(() => props.isOpen, async (val) => {
  if (val) {
    step.value = 'type';
    searchQuery.value = '';
    selectedIndex.value = 0;
    if (loadedSchemas.value.length === 0) {
      try {
        loadedSchemas.value = await api.getEntitySchemas(props.project);
      } catch (e) {
        console.error('Failed to load schemas', e);
      }
    }
    nextTick(() => searchInput.value?.focus());
  }
});

watch(searchQuery, () => {
  selectedIndex.value = 0;
});

const moveSelection = (dir: number) => {
  const max = step.value === 'type' ? filteredTypes.value.length - 1 : filteredEntities.value.length - 1;
  if (max < 0) return;
  selectedIndex.value += dir;
  if (selectedIndex.value < 0) selectedIndex.value = max;
  if (selectedIndex.value > max) selectedIndex.value = 0;

  // Scroll into view
  nextTick(() => {
    if (listEl.value) {
      const activeEl = listEl.value.querySelector('.selector-item.active') as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  });
};

const selectCurrent = () => {
  if (step.value === 'type' && filteredTypes.value[selectedIndex.value]) {
    selectType(filteredTypes.value[selectedIndex.value]);
  } else if (step.value === 'entity' && filteredEntities.value[selectedIndex.value]) {
    selectEntity(filteredEntities.value[selectedIndex.value]);
  }
};

const selectType = async (type: any) => {
  selectedType.value = type;
  searchQuery.value = '';
  selectedIndex.value = 0;
  
  try {
    const res = await api.getEntities(props.project, type.id);
    entitiesList.value = res.map((r: any) => {
      // Very basic name extraction
      let name = 'Без названия';
      if (r.name) name = r.name;
      else if (r.title) name = r.title;
      else if (r.fio) name = r.fio;
      return { ...r, name };
    });
  } catch (e) {
    console.error('Failed to load entities', e);
    entitiesList.value = [];
  }

  step.value = 'entity';
  nextTick(() => searchInput.value?.focus());
};

const selectEntity = (entity: any) => {
  emit('insert', { type: selectedType.value.id, id: entity.id });
  close();
};

const close = () => {
  emit('close');
};
</script>

<style scoped>
.entity-link-selector-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
}

.entity-link-selector-modal {
  width: 400px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-input);
  border-bottom: 1px solid var(--border-color);
}

.selector-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--text-color);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
}

.close-btn:hover {
  color: var(--text-color);
}

.selector-body {
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.selector-search {
  margin: 12px;
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  outline: none;
}

.selector-search:focus {
  border-color: var(--accent);
}

.selector-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.selector-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  gap: 12px;
}

.selector-item.active {
  background: var(--accent);
  color: #fff;
}

.item-icon {
  font-size: 16px;
}

.item-name {
  flex: 1;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-id {
  font-size: 11px;
  opacity: 0.5;
}

.back-btn {
  padding: 8px 12px;
  cursor: pointer;
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
}

.back-btn:hover {
  text-decoration: underline;
}

.selector-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
