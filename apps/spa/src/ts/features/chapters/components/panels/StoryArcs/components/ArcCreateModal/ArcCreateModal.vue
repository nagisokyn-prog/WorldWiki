<template>
  <Teleport to="body">
    <div
      class="arc-modal-overlay"
      @click.self="$emit('close')"
    >
      <div class="arc-modal-box">
        <h3 class="arc-modal-title">Создать Сюжетную Линию (Арку)</h3>

        <div class="arc-modal-field">
          <label class="arc-modal-label">Название арки:</label>
          <input
            :value="title"
            type="text"
            placeholder="Например: Арка Примирения с Эрис..."
            class="arc-modal-input"
            @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="arc-modal-field">
          <label class="arc-modal-label">Тип арки:</label>
          <XboxWheel
            :model-value="arcType"
            :options="arcTypeOptions"
            @update:model-value="$emit('update:arcType', $event as ArcType)"
          />
        </div>

        <div class="arc-modal-actions">
          <button
            type="button"
            class="arc-modal-btn"
            @click="$emit('close')"
          >
            Отмена
          </button>
          <button
            type="button"
            class="arc-modal-btn arc-modal-btn-primary"
            :disabled="!title.trim()"
            @click="$emit('create')"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { ArcCreateModalProps, ArcCreateModalEmits } from './ArcCreateModal.model';
import type { ArcType } from '../../StoryArcs.model';

const arcTypeOptions = [
  { value: 'character', label: 'Персонаж (Character)' },
  { value: 'event', label: 'Событие (Event)' },
  { value: 'relationship', label: 'Отношения (Relationship)' },
  { value: 'theme', label: 'Тема (Theme)' },
];

defineProps<ArcCreateModalProps>();

defineEmits<ArcCreateModalEmits>();
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ArcCreateModal.css"></style>
