<template>
  <div
    class="fixed inset-0 bg-backdrop flex items-center justify-center z-50 p-4"
    @click.self="$emit('close')"
  >
    <div class="modal-box p-6 rounded-lg border border-subtle bg-surface w-full max-w-md space-y-4 shadow-lg">
      <h3 class="text-base font-bold m-0">Создать Сюжетную Линию (Арку)</h3>

      <div class="space-y-2">
        <label class="text-xs font-bold text-muted">Название арки:</label>
        <input
          :value="title"
          type="text"
          placeholder="Например: Арка Примирения с Эрис..."
          class="w-full text-xs px-3 py-2 rounded border border-subtle bg-input text-main"
          @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="space-y-2">
        <label class="text-xs font-bold text-muted">Тип арки:</label>
        <XboxWheel
          :model-value="arcType"
          :options="arcTypeOptions"
          class="w-full"
          @update:model-value="$emit('update:arcType', $event as ArcType)"
        />
      </div>

      <div class="flex justify-end gap-2 pt-3">
        <button
          class="px-4 py-1.5 text-xs rounded border border-subtle bg-surface hover:bg-surface-hover text-main cursor-pointer"
          @click="$emit('close')"
        >
          Отмена
        </button>
        <button
          class="px-4 py-1.5 text-xs rounded font-bold bg-accent text-surface cursor-pointer"
          :disabled="!title.trim()"
          @click="$emit('create')"
        >
          Создать
        </button>
      </div>
    </div>
  </div>
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
