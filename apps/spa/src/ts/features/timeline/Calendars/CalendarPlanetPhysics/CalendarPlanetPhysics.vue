<template>
  <div class="calendar-section planet-physics-card">
    <div class="section-header planet-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <h4 class="m-0">🪐 Планетарная физика</h4>
        <span class="badge-planet">{{ planetId }}</span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="mt-3">
      <div class="grid-2 gap-3 mb-3">
        <div class="calendar-field">
          <label class="glass-label">ID целевой планеты</label>
          <input v-model="planetId" type="text" class="interactive-el" placeholder="earth / mars" />
        </div>
        <div class="calendar-field">
          <label class="glass-label">Наклон оси (°)</label>
          <input v-model.number="axialTilt" type="number" step="0.1" class="interactive-el" />
        </div>
      </div>

      <div class="grid-2 gap-3 mb-3">
        <div class="calendar-field">
          <label class="glass-label">Начало суток</label>
          <select v-model="dayStartMode" class="interactive-el select-field">
            <option value="midnight">Полночь (стандарт)</option>
            <option value="sunrise">Рассвет (эфиопский стиль)</option>
            <option value="sunset">Закат (иудейский стиль)</option>
          </select>
        </div>
        <div class="flex items-center gap-2 pt-4">
          <label class="glass-checkbox-label">
            <input v-model="retrograde" type="checkbox" class="interactive-el" />
            <span>🔄 Ретроградное вращение (Венера)</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarPlanetPhysics } from './useCalendarPlanetPhysics';
import type { CalendarPlanetPhysicsProps, CalendarPlanetPhysicsEmits } from './CalendarPlanetPhysics.model';

const props = defineProps<CalendarPlanetPhysicsProps>();
const emit = defineEmits<CalendarPlanetPhysicsEmits>();

const { isCollapsed, planetId, retrograde, axialTilt, dayStartMode } = useCalendarPlanetPhysics(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarPlanetPhysics.css"></style>
