<template>
  <div class="journey-toolbar">
    <!-- Entity Selector & Title -->
    <div class="journey-toolbar-left">
      <h2 class="journey-title">
        <span>📜</span>
        <span>Путь Персонажей</span>
      </h2>

      <!-- Multi Entity Chip Selector -->
      <JourneyMultiSelector
        :selected-entities="selectedEntities"
        :entities-list="entitiesList"
        @add="$emit('add-entity', $event)"
        @remove="$emit('remove-entity', $event)"
      />

      <!-- Union / Intersection Mode Toggle (visible when >= 2 characters selected) -->
      <JourneyModeToggle
        v-if="selectedEntities.length > 1"
        :model-value="filterMode"
        @update:model-value="onFilterModeUpdate"
      />
    </div>

    <!-- Mode Selector Tabs (Arcs / Narrative / Chronology) -->
    <div class="journey-view-tabs">
      <button
        class="journey-tab-btn"
        :class="{ active: viewMode === 'BY_ARCS' }"
        title="Группировка сцен по сюжетным аркам"
        @click="$emit('update:viewMode', 'BY_ARCS')"
      >
        🗺️ По аркам
      </button>
      <button
        class="journey-tab-btn"
        :class="{ active: viewMode === 'NARRATIVE' }"
        title="По порядку глав в рукописи (от лица читателя)"
        @click="$emit('update:viewMode', 'NARRATIVE')"
      >
        📖 Для читателя
      </button>
      <button
        class="journey-tab-btn"
        :class="{ active: viewMode === 'CHRONOLOGY' }"
        title="По абсолютному времени мира (M_abs)"
        @click="$emit('update:viewMode', 'CHRONOLOGY')"
      >
        ⏳ Хронология
      </button>
    </div>

    <!-- Filters & Refresh -->
    <div class="journey-toolbar-right">
      <!-- Arc Filter -->
      <select
        v-if="storyArcs.length > 0"
        :value="selectedArcFilter"
        class="journey-filter-select"
        @change="$emit('update:selectedArcFilter', ($event.target as HTMLSelectElement).value)"
      >
        <option value="ALL">Все арки</option>
        <option value="UNASSIGNED">Вне арок</option>
        <option
          v-for="arc in storyArcs"
          :key="arc.id || arc.title"
          :value="arc.id"
        >
          {{ arc.title }}
        </option>
      </select>

      <!-- Category Filter -->
      <select
        :value="filterType"
        class="journey-filter-select"
        @change="$emit('update:filterType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="all">Все элементы</option>
        <option value="scenes">Сцены и главы</option>
        <option value="promises">Сюжетные ружья</option>
        <option value="events">События мира</option>
        <option value="relations">Отношения</option>
      </select>

      <button
        class="btn-refresh"
        :disabled="isLoading"
        @click="$emit('refresh')"
      >
        🔄 {{ isLoading ? '...' : 'Обновить' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { JourneyToolbarProps, JourneyToolbarEmits } from './JourneyToolbar.model';
import type { Entity } from '@/types/generated/Entity';
import type { StoryArc } from '@/stores/story_arcs.store';
import type { CharacterJourneyViewMode, JourneyFilterMode } from '../CharacterJourney.model';
import JourneyMultiSelector from './JourneyMultiSelector.vue';
import JourneyModeToggle from './JourneyModeToggle.vue';

defineProps<JourneyToolbarProps>();

const emit = defineEmits<JourneyToolbarEmits>();

const onFilterModeUpdate = (val: JourneyFilterMode) => {
  emit('update:filterMode', val);
  emit('update:filter-mode', val);
};
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>


