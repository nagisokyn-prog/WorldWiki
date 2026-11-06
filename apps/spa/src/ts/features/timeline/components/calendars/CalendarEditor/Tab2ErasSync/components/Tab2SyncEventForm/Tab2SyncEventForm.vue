<template>
  <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;">
    <div class="grid-3" style="align-items: end;">
      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <label class="form-label" style="margin: 0;">Опорное событие</label>
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-ghost-sm"
            style="padding: 1px 6px; font-size: 10px;"
            @click="$emit('add-new-event')"
          >
            ➕ Новое событие
          </button>
        </div>
        <XboxWheel
          :model-value="selectedEventId"
          :options="eventOptions"
          @update:model-value="$emit('update-selected-event', $event)"
        />
      </div>

      <div class="form-group">
        <label class="form-label">Направление</label>
        <div style="display: flex; gap: 12px; padding-top: 6px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input
              type="radio"
              name="sync-dir-event"
              value="after"
              :checked="offsetDirection === 'after'"
              :disabled="isReadOnly"
              @change="$emit('update-offset-direction', 'after')"
            />
            <span>После события</span>
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input
              type="radio"
              name="sync-dir-event"
              value="before"
              :checked="offsetDirection === 'before'"
              :disabled="isReadOnly"
              @change="$emit('update-offset-direction', 'before')"
            />
            <span>До события</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <!-- Тултип к «Смещение (лет)» (Пункт 9) -->
        <label
          class="form-label"
          title="Количество лет между опорным историческим событием мира и точкой отсчета данного календаря. Например, если календарь начался через 500 лет после Падения Империи, укажите 500 лет 'После события'."
        >
          Смещение (лет) <span style="font-size: 11px; opacity: 0.7;">ℹ️</span>
        </label>
        <input
          type="number"
          class="form-input"
          :value="offsetYears"
          min="0"
          :disabled="isReadOnly"
          @input="$emit('update-offset-years', parseInt(($event.target as HTMLInputElement).value) || 0)"
        />
      </div>
    </div>

    <!-- Быстрое редактирование выбранной вехи прямо здесь -->
    <div
      v-if="currentEvent"
      style="display: flex; gap: 8px; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-subtle);"
    >
      <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Веха:</span>
      <input
        :value="currentEvent.name"
        type="text"
        class="form-input"
        style="flex: 1; padding: 4px 8px; font-size: 12px;"
        :disabled="isReadOnly"
        @input="$emit('save-current-event', { ...currentEvent, name: ($event.target as HTMLInputElement).value })"
      />
      <span style="font-size: 11px; color: var(--text-muted);">Год в Календаре Мира:</span>
      <input
        :value="currentEvent.year"
        type="number"
        class="form-input"
        style="width: 80px; padding: 4px 8px; font-size: 12px;"
        :disabled="isReadOnly"
        @input="$emit('save-current-event', { ...currentEvent, year: +($event.target as HTMLInputElement).value })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { Tab2SyncEventFormProps, Tab2SyncEventFormEmits } from './Tab2SyncEventForm.model';
import { useTab2SyncEventForm } from './useTab2SyncEventForm';

const props = defineProps<Tab2SyncEventFormProps>();

defineEmits<Tab2SyncEventFormEmits>();

const { eventOptions } = useTab2SyncEventForm(props);
</script>
