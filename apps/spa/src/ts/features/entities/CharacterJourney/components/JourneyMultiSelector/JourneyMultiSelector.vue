<template>
  <div class="journey-multi-selector">
    <div class="journey-chips-list">
      <div
        v-for="ent in selectedEntities"
        :key="ent.id || ent.name"
        class="entity-chip"
      >
        <span class="entity-chip-avatar">👤</span>
        <span class="entity-chip-name">{{ ent.name }}</span>
        <button
          v-if="selectedEntities.length > 1 && ent.id"
          type="button"
          class="entity-chip-remove"
          title="Удалить персонажа из выборки"
          @click="handleRemove(ent.id)"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Dropdown to add character -->
    <XboxWheel
      v-if="availableEntities.length > 0"
      :model-value="''"
      :options="availableWheelOptions"
      placeholder="+ Добавить персонажа..."
      @update:model-value="handleAddValue"
    />
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { JourneyMultiSelectorProps, JourneyMultiSelectorEmits } from './JourneyMultiSelector.model';
import { useJourneyMultiSelector } from './useJourneyMultiSelector';

const props = defineProps<JourneyMultiSelectorProps>();

const emit = defineEmits<JourneyMultiSelectorEmits>();

const { availableEntities, availableWheelOptions, handleAddValue, handleRemove } = useJourneyMultiSelector(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>

