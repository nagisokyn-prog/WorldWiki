<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">⚔️ Опорные исторические события мира (Вехи)</div>
        <div class="section-desc">Ключевые даты, сквозь которые синхронизируются все хроники разных народов.</div>
      </div>
      <button
        v-if="!isReadOnly"
        type="button"
        class="btn-ghost-sm"
        @click="showAddRow = true"
      >
        + Опорное событие
      </button>
    </div>

    <!-- Список чипов опорных событий -->
    <div class="chip-list">
      <span
        v-for="(ev, idx) in anchorEvents"
        :key="ev.id || idx"
        class="preset-chip active"
        style="display: inline-flex; align-items: center; gap: 6px;"
      >
        <span>{{ ev.name }} (Год {{ ev.year }})</span>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-icon-table"
          style="padding: 0; font-size: 11px; margin-left: 4px;"
          title="Удалить веху"
          @click.stop="$emit('remove-anchor-event', idx)"
        >
          ✕
        </button>
      </span>
    </div>

    <!-- Строка быстрого добавления нового опорного события -->
    <div
      v-if="showAddRow && !isReadOnly"
      style="display: flex; gap: 8px; margin-top: 10px; align-items: center; background: var(--bg-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);"
    >
      <input
        v-model="newEventName"
        type="text"
        class="form-input"
        style="flex: 1;"
        placeholder="Название события (напр. Коронация Первого Императора)..."
        @keydown.enter="submitNewEvent"
      />
      <input
        v-model.number="newEventYear"
        type="number"
        class="form-input"
        style="width: 90px;"
        placeholder="Год"
        @keydown.enter="submitNewEvent"
      />
      <button
        type="button"
        class="btn-action btn-primary"
        style="white-space: nowrap; padding: 6px 12px;"
        @click="submitNewEvent"
      >
        Добавить
      </button>
      <button
        type="button"
        class="btn-ghost-sm"
        @click="showAddRow = false"
      >
        Отмена
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnchorEventDto } from '../Tab2ErasSync.model';
import { useTab2AnchorEventsSection } from './useTab2AnchorEventsSection';

defineProps<{
  anchorEvents: AnchorEventDto[];
  isReadOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'add-anchor-event', event: AnchorEventDto): void;
  (e: 'remove-anchor-event', idx: number): void;
}>();

const { showAddRow, newEventName, newEventYear, submitNewEvent } = useTab2AnchorEventsSection(
  (e, event) => emit(e, event),
);
</script>
