<template>
  <div class="calendar-section dial-card">
    <div class="section-header dial-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <h4 class="m-0">⏰ Фэнтезийный циферблат</h4>
        <span class="badge-dial" :class="isBijective ? 'badge-success' : 'badge-warning'">
          {{ isBijective ? 'Биективен' : 'Квантуется' }}
        </span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="mt-3">
      <div class="dial-metrics flex justify-between text-xs text-muted mb-2">
        <span>Вместимость: <strong>{{ totalCapacity }}</strong></span>
        <span>Квант: <strong>{{ quantumErrorSec }} сек/ед</strong></span>
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

<style scoped>
.dial-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-3, 12px);
}

.dial-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.badge-dial {
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-size: 11px;
  font-weight: 600;
}

.badge-success {
  background: var(--success-bg, rgba(34, 197, 94, 0.15));
  color: var(--success);
}

.badge-warning {
  background: var(--warning-bg, rgba(245, 158, 11, 0.15));
  color: var(--warning);
}

.unit-name-input {
  flex: 2;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  color: var(--text-primary);
}

.unit-sub-input {
  width: 80px;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  color: var(--text-primary);
}
</style>
