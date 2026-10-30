<template>
  <div class="journey-container flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- Header Toolbar -->
    <JourneyToolbar
      :selected-entities="selectedEntities"
      :entities-list="entitiesList"
      :view-mode="viewMode"
      :selected-arc-filter="selectedArcFilter"
      :filter-type="filterType"
      :filter-mode="filterMode"
      :story-arcs="storyArcs"
      :is-loading="isLoading"
      @add-entity="addEntity"
      @remove-entity="removeEntity"
      @update:filter-mode="setFilterMode"
      @update:view-mode="viewMode = $event"
      @update:selected-arc-filter="selectedArcFilter = $event"
      @update:filter-type="filterType = $event"
      @refresh="refresh"
    />

    <!-- Main Content Area -->
    <div class="journey-content flex-1 overflow-y-auto p-6">
      <div v-if="isLoading && !timelineItems.length" class="flex items-center justify-center h-48 text-muted text-sm">
        Загрузка истории и сцен персонажей...
      </div>

      <div v-else-if="!timelineItems.length" class="flex items-center justify-center h-48 text-muted text-sm">
        По выбранным персонажам пока нет зафиксированных сцен, связей или сюжетных арок.
      </div>

      <!-- 1. РЕЖИМ 1: Группировка по аркам -->
      <JourneyArcGroups
        v-else-if="viewMode === 'BY_ARCS'"
        :arc-groups="arcGroups"
        :current-entity="currentEntity"
        :selected-entities="selectedEntities"
        @select-scene="$emit('select-scene', $event)"
      />

      <!-- 2. РЕЖИМ 2 и 3: Линейный таймлайн (Для читателя или Хронология мира) -->
      <JourneyTimelineList
        v-else
        :timeline-items="timelineItems"
        @select-scene="$emit('select-scene', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CharacterJourneyProps, CharacterJourneyEmits, JourneyTimelineItem } from './CharacterJourney.model';
import { useCharacterJourney } from './useCharacterJourney';
import JourneyToolbar from './components/JourneyToolbar.vue';
import JourneyArcGroups from './components/JourneyArcGroups.vue';
import JourneyTimelineList from './components/JourneyTimelineList.vue';

const props = withDefaults(
  defineProps<CharacterJourneyProps>(),
  {
    projectId: '',
    entityId: '',
  }
);

defineEmits<CharacterJourneyEmits>();

const {
  selectedEntities,
  currentEntity,
  entitiesList,
  viewMode,
  selectedArcFilter,
  filterType,
  filterMode,
  timelineItems,
  arcGroups,
  storyArcs,
  isLoading,
  addEntity,
  removeEntity,
  setFilterMode,
  refresh,
} = useCharacterJourney(props.projectId, props.entityId);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>

