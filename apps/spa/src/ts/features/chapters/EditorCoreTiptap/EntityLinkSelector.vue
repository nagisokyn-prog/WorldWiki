<template>
  <div v-if="props.isOpen" class="entity-link-selector-overlay" @click.self="close">
    <div class="entity-link-selector-modal">
      <div class="selector-header">
        <h3>Вставка сущности в текст</h3>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <!-- Фильтры по типам -->
      <div class="selector-tabs">
        <button
          type="button"
          class="selector-tab"
          :class="{ 'is-active': activeTypeFilter === 'all' }"
          @click="setTypeFilter('all')"
        >
          Все
        </button>
        <button
          v-for="t in entityTypes"
          :key="t.id"
          type="button"
          class="selector-tab"
          :class="{ 'is-active': activeTypeFilter === t.id }"
          @click="setTypeFilter(t.id)"
        >
          {{ t.icon }} {{ t.name }}
        </button>
      </div>
      
      <div class="selector-body">
        <input 
          ref="searchInput"
          v-model="searchQuery"
          type="text" 
          placeholder="Поиск сущности или #тега..."
          class="selector-search"
          @keydown.down.prevent="moveSelection(1)"
          @keydown.up.prevent="moveSelection(-1)"
          @keydown.enter.prevent="selectCurrent"
          @keydown.esc.prevent="close"
        />

        <div ref="listEl" class="selector-list">
          <div 
            v-for="(entity, idx) in filteredEntities" 
            :key="entity.id"
            class="selector-item"
            :class="{ active: selectedIndex === idx }"
            @click="selectEntity(entity)"
            @mouseenter="selectedIndex = idx"
          >
            <span class="item-icon">{{ entity.type_icon }}</span>
            <div class="item-details">
              <div class="item-main">
                <span class="item-name">{{ entity.name }}</span>
                <span class="item-type-badge">({{ entity.type_name }})</span>
              </div>
              <div v-if="entity.tags && entity.tags.length > 0" class="item-tags">
                <span v-for="tag in entity.tags" :key="tag" class="tag-badge">#{{ tag.replace(/^#/, '') }}</span>
              </div>
            </div>
            <span class="item-id">{{ entity.id.split(':').pop() }}</span>
          </div>

          <!-- Кнопка быстрого создания новой сущности -->
          <div
            v-if="showQuickCreate"
            class="selector-item quick-create"
            :class="{ active: selectedIndex === filteredEntities.length }"
            @click="quickCreateEntity()"
            @mouseenter="selectedIndex = filteredEntities.length"
          >
            <span class="item-icon">✨</span>
            <div class="item-details">
              <span class="item-name">+ Создать "{{ searchQuery.trim() }}"</span>
            </div>
          </div>

          <div v-if="filteredEntities.length === 0 && !showQuickCreate" class="selector-empty">
            Сущности не найдены
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEntityLinkSelector } from './useEntityLinkSelector';
import type { EntityLinkSelectorProps, EntityLinkSelectorEmits } from './EntityLinkSelector.model';

const props = withDefaults(defineProps<EntityLinkSelectorProps>(), {
  isOpen: false
});

const emit = defineEmits<EntityLinkSelectorEmits>();

const {
  searchQuery,
  activeTypeFilter,
  selectedIndex,
  searchInput,
  listEl,
  entityTypes,
  filteredEntities,
  showQuickCreate,
  moveSelection,
  selectCurrent,
  selectEntity,
  quickCreateEntity,
  setTypeFilter,
  close
} = useEntityLinkSelector(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/EntityLinkSelector.css"></style>

