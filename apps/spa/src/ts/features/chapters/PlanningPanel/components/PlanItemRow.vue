<template>
  <div
    class="plan-item-row"
    :class="{
      'is-blocked': item.status === 'blocked',
      'is-in-progress': item.status === 'in_progress',
      'is-done': item.status === 'done' || item.done
    }"
  >
    <div class="plan-item-main flex items-center gap-2 w-full">
      <!-- Status Icon Toggle -->
      <button
        type="button"
        class="plan-status-btn"
        :class="[`status-${item.status}`, { done: item.status === 'done' || item.done }]"
        :title="statusTooltip"
        @click="onToggle"
        @contextmenu.prevent="onCycleStatus"
      >
        <span v-if="item.status === 'done' || item.done" class="status-icon-done">✓</span>
        <span v-else-if="item.status === 'in_progress'" class="status-pulse-dot" title="В работе 🟡"></span>
        <span v-else-if="item.status === 'blocked'" class="status-icon-lock" title="Ожидает 🔒">🔒</span>
        <span v-else class="status-icon-planned" title="В планах ⚪"></span>
      </button>

      <!-- Input Text -->
      <input
        v-model="item.text"
        class="plan-item-input flex-1"
        :class="{ done: item.status === 'done' || item.done }"
        placeholder="Пункт плана..."
        @blur="onSave"
        @keydown.enter.prevent="onSave"
      />

      <!-- Delete Button -->
      <button
        type="button"
        class="plan-item-delete-btn"
        title="Удалить задачу"
        @click="onDelete"
      >
        ×
      </button>
    </div>

    <!-- Causality Links (Depends On / Blocks) -->
    <div v-if="item.depends_on_title || item.blocks_title" class="plan-item-causality">
      <span
        v-if="item.depends_on_title"
        class="causality-badge depends-badge"
        :title="'Ожидает выполнения: ' + item.depends_on_title"
      >
        <span>⛓️</span>
        <span>Ждёт: {{ item.depends_on_title }}</span>
      </span>

      <button
        v-if="item.blocks_title && item.blocks_chapter_id"
        type="button"
        class="causality-badge blocks-badge"
        :title="'Открывает шаг в главе: ' + item.blocks_title"
        @click.stop="onNavigate(item.blocks_chapter_id)"
      >
        <span>🔗</span>
        <span>Открывает: {{ item.blocks_title }} ➔</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanItemRowProps, PlanItemRowEmits } from './PlanItemRow.model';
import { usePlanItemRow } from './usePlanItemRow';

const props = defineProps<PlanItemRowProps>();
const emit = defineEmits<PlanItemRowEmits>();

const {
  statusTooltip,
  onToggle,
  onCycleStatus,
  onSave,
  onDelete,
  onNavigate
} = usePlanItemRow(props, emit);
</script>
