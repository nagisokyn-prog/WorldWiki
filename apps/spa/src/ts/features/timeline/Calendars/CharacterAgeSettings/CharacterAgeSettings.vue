<template>
  <div class="calendar-section age-settings-card">
    <div class="section-header age-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <h4 class="m-0">👶 Система возраста персонажей</h4>
        <span class="badge-age">{{ selectedSystem === 'east_asian' ? 'Восточноазиатская (+1)' : (selectedSystem === 'year_only' ? 'Календарная' : 'Западная') }}</span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="mt-3">
      <div class="calendar-field mb-3">
        <label class="glass-label">Правило подсчета возраста</label>
        <select v-model="selectedSystem" class="interactive-el select-field">
          <option value="western">Западная (0 лет при рождении, +1 в день рождения)</option>
          <option value="east_asian">Восточноазиатская (1 год при рождении, +1 в Новый Год)</option>
          <option value="year_only">Календарная (разница между текущим и годом рождения)</option>
        </select>
      </div>

      <div class="age-sample-box text-xs text-muted">
        <span>💡 Пример: Родился 15-го числа 6-го месяца 1000 г. На начало 1020 года возраст составит: <strong>{{ sampleAge }} лет</strong></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCharacterAgeSettings } from './useCharacterAgeSettings';
import type { CharacterAgeSettingsProps, CharacterAgeSettingsEmits } from './CharacterAgeSettings.model';

const props = defineProps<CharacterAgeSettingsProps>();
const emit = defineEmits<CharacterAgeSettingsEmits>();

const { isCollapsed, selectedSystem, sampleAge } = useCharacterAgeSettings(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CharacterAgeSettings.css"></style>
