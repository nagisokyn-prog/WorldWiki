<template>
  <div class="journey-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-subtle bg-surface">
    <!-- Entity Selector & Title -->
    <div class="flex items-center gap-3">
      <span class="text-base font-bold flex items-center gap-1.5">
        <span>📜</span>
        <span>Путь Персонажа</span>
      </span>

      <!-- Entity Switcher -->
      <select
        v-if="entitiesList.length > 0"
        :value="currentEntityId"
        class="text-xs font-medium px-2 py-1 rounded border border-subtle bg-input text-main"
        @change="$emit('update:currentEntityId', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="ent in entitiesList"
          :key="ent.id || ent.name"
          :value="ent.id"
        >
          {{ ent.name }} ({{ ent.entity_type }})
        </option>
      </select>
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
    <div class="flex items-center gap-2">
      <!-- Arc Filter -->
      <select
        v-if="storyArcs.length > 0"
        :value="selectedArcFilter"
        class="text-xs px-2 py-1.5 rounded border border-subtle bg-input text-main"
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
        class="text-xs px-2 py-1.5 rounded border border-subtle bg-input text-main"
        @change="$emit('update:filterType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="all">Все элементы</option>
        <option value="scenes">Сцены и главы</option>
        <option value="promises">Сюжетные ружья</option>
        <option value="events">События мира</option>
        <option value="relations">Отношения</option>
      </select>

      <button
        class="btn-refresh text-xs px-3 py-1.5 rounded border border-subtle bg-surface-hover hover:bg-surface text-main cursor-pointer"
        :disabled="isLoading"
        @click="$emit('refresh')"
      >
        🔄 {{ isLoading ? '...' : 'Обновить' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Entity } from '@/types/generated/Entity';
import type { StoryArc } from '@/stores/story_arcs.store';
import type { CharacterJourneyViewMode } from '../CharacterJourney.model';

defineProps<{
  currentEntityId: string;
  entitiesList: Entity[];
  viewMode: CharacterJourneyViewMode;
  selectedArcFilter: string;
  filterType: string;
  storyArcs: StoryArc[];
  isLoading: boolean;
}>();

defineEmits<{
  (e: 'update:currentEntityId', val: string): void;
  (e: 'update:viewMode', val: CharacterJourneyViewMode): void;
  (e: 'update:selectedArcFilter', val: string): void;
  (e: 'update:filterType', val: string): void;
  (e: 'refresh'): void;
}>();
</script>
