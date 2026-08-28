<template>
  <div v-if="isOpen" class="entity-link-selector-overlay" @click.self="close">
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

        <div ref="listEl" class="selector-list">
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
import type { EntitySchema } from '../../../types/generated/EntitySchema';

export interface EntityTypeItem {
  id: string;
  name: string;
  icon: string;
}

export interface EntitySelectorItem {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface InsertEntityPayload {
  type: string;
  id: string;
  name?: string;
}

const props = withDefaults(defineProps<{
  project: string;
  isOpen?: boolean;
}>(), {
  isOpen: false
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'insert', payload: InsertEntityPayload): void;
}>();

const step = ref<'type' | 'entity'>('type');
const searchQuery = ref('');
const selectedIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLElement | null>(null);

const loadedSchemas = ref<EntitySchema[]>([]);
const selectedType = ref<EntityTypeItem | null>(null);
const entitiesList = ref<EntitySelectorItem[]>([]);

const entityTypes = computed<EntityTypeItem[]>(() => {
  return loadedSchemas.value.map((s) => ({
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
  return entitiesList.value.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
});

const isModalOpen = computed(() => props.isOpen);

watch(isModalOpen, async (open) => {
  if (open) {
    step.value = 'type';
    searchQuery.value = '';
    selectedIndex.value = 0;
    selectedType.value = null;
    entitiesList.value = [];
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

const selectType = async (type: EntityTypeItem) => {
  selectedType.value = type;
  searchQuery.value = '';
  selectedIndex.value = 0;
  
  try {
    const res = await api.getEntities(props.project, type.id);
    entitiesList.value = res.map((r) => {
      let name = 'Без названия';
      if (r.name) name = r.name;
      else if ((r as { title?: string }).title) name = (r as { title?: string }).title || 'Без названия';
      else if ((r as { fio?: string }).fio) name = (r as { fio?: string }).fio || 'Без названия';
      return { ...r, id: r.id || '', name };
    });
  } catch (e) {
    console.error('Failed to load entities', e);
    entitiesList.value = [];
  }

  step.value = 'entity';
  nextTick(() => searchInput.value?.focus());
};

const selectEntity = (entity: EntitySelectorItem) => {
  if (selectedType.value) {
    emit('insert', {
      type: selectedType.value.id,
      id: entity.id,
      name: entity.name
    });
  }
  close();
};

const close = () => {
  emit('close');
};
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/EntityLinkSelector.css"></style>
