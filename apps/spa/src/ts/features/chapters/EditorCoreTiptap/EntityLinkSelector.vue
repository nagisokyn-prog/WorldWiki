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
import { 
  useEntityLinkSelector, 
  type EntityLinkSelectorProps, 
  type EntityLinkSelectorEmits,
  type EntityTypeItem,
  type EntitySelectorItem,
  type InsertEntityPayload
} from './useEntityLinkSelector';

export type { EntityTypeItem, EntitySelectorItem, InsertEntityPayload };

const props = withDefaults(defineProps<EntityLinkSelectorProps>(), {
  isOpen: false
});

const emit = defineEmits<EntityLinkSelectorEmits>();

const {
  step,
  searchQuery,
  selectedIndex,
  searchInput,
  listEl,
  filteredTypes,
  filteredEntities,
  moveSelection,
  selectCurrent,
  selectType,
  selectEntity,
  close
} = useEntityLinkSelector(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/EntityLinkSelector.css"></style>
