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
        <select
          :value="arcType"
          class="w-full text-xs px-3 py-2 rounded border border-subtle bg-input text-main"
          @change="$emit('update:arcType', ($event.target as HTMLSelectElement).value as ArcType)"
        >
          <option value="character">Персонаж (Character)</option>
          <option value="event">Событие (Event)</option>
          <option value="relationship">Отношения (Relationship)</option>
          <option value="theme">Тема (Theme)</option>
        </select>
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
import type { ArcCreateModalProps, ArcCreateModalEmits } from './ArcCreateModal.model';
import type { ArcType } from '../../StoryArcs.model';

defineProps<ArcCreateModalProps>();

defineEmits<ArcCreateModalEmits>();
</script>
