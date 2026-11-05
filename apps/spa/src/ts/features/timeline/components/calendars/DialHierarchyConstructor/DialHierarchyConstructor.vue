<template>
  <div class="calendar-section dial-card">
    <div class="section-header dial-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <h4 class="m-0">⏰ Деление суток (Циферблат)</h4>
        <span
          class="badge-dial"
          :class="isBijective ? 'badge-success' : 'badge-warning'"
          :title="isBijective ? 'Сутки планеты делятся ровно без остатка секунд' : 'Деления не укладываются ровно в сутки, будет погрешность в секундах'"
        >
          {{ isBijective ? '✓ Точное деление' : '⚠️ С остатком' }}
        </span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="mt-3">
      <div class="dial-metrics flex justify-between text-xs text-muted mb-2">
        <span>Делений в сутках: <strong>{{ totalCapacity }}</strong></span>
        <span>Шаг единицы: <strong>{{ quantumErrorSec }} сек</strong></span>
      </div>

      <div class="units-list mb-3">
        <div v-for="(unit, idx) in dialUnits" :key="idx" class="unit-row flex gap-2 items-center mb-2">
          <input v-model="unit.name" type="text" class="interactive-el unit-name-input" placeholder="Название (страж/кэ)" />
          <span class="text-xs text-muted">Делений:</span>
          <input v-model.number="unit.subdivisions" type="number" min="1" class="interactive-el unit-sub-input" />
          <button
            type="button"
            class="btn-icon interactive-el"
            :disabled="dialUnits.length <= 1"
            @click.prevent="removeUnit(idx)"
          >
            🗑️
          </button>
        </div>
      </div>

      <button type="button" class="btn-add interactive-el" @click.prevent="addUnit">
        ➕ Добавить единицу времени
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDialHierarchyConstructor } from './useDialHierarchyConstructor';
import type { DialHierarchyConstructorProps, DialHierarchyConstructorEmits } from './DialHierarchyConstructor.model';

const props = defineProps<DialHierarchyConstructorProps>();
const emit = defineEmits<DialHierarchyConstructorEmits>();

const {
  isCollapsed,
  dialUnits,
  totalCapacity,
  isBijective,
  quantumErrorSec,
  addUnit,
  removeUnit,
} = useDialHierarchyConstructor(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/DialHierarchyConstructor.css"></style>
