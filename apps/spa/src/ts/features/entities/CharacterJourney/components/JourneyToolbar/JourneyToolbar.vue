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
      <XboxWheel
        v-if="storyArcs.length > 0"
        :model-value="selectedArcFilter"
        :options="arcWheelOptions"
        @update:model-value="$emit('update:selectedArcFilter', $event)"
      />

      <!-- Category Filter -->
      <XboxWheel
        :model-value="filterType"
        :options="categoryWheelOptions"
        @update:model-value="$emit('update:filterType', $event)"
      />

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
import { XboxWheel } from '@worldwiki/components';
import type { JourneyToolbarProps, JourneyToolbarEmits } from './JourneyToolbar.model';
import JourneyMultiSelector from '../JourneyMultiSelector/JourneyMultiSelector.vue';
import JourneyModeToggle from '../JourneyModeToggle/JourneyModeToggle.vue';
import { useJourneyToolbar } from './useJourneyToolbar';

const props = defineProps<JourneyToolbarProps>();
const emit = defineEmits<JourneyToolbarEmits>();

const { arcWheelOptions, categoryWheelOptions, onFilterModeUpdate } = useJourneyToolbar(emit, props);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>


