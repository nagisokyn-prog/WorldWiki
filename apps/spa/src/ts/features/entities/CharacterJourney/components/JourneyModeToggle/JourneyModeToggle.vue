<template>
  <div class="journey-mode-toggle" role="group" aria-label="Режим фильтрации мульти-пути">
    <button
      type="button"
      class="journey-mode-btn"
      :class="{ active: modelValue === 'union' }"
      title="Все сцены, где появляется хотя бы один из выбранных персонажей"
      @click="$emit('update:modelValue', 'union')"
    >
      🌐 Все сцены
    </button>
    <button
      type="button"
      class="journey-mode-btn"
      :class="{ active: modelValue === 'intersection' }"
      title="Только сцены совместного присутствия всех выбранных персонажей"
      @click="$emit('update:modelValue', 'intersection')"
    >
      🤝 Только совместные
    </button>
  </div>
</template>

<script setup lang="ts">
import type { JourneyModeToggleProps, JourneyModeToggleEmits } from './JourneyModeToggle.model';

defineProps<JourneyModeToggleProps>();

defineEmits<JourneyModeToggleEmits>();
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>
