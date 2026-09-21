<template>
  <aside class="schema-catalog history-sidebar-drawer">
    <div class="flex justify-between items-center p-3 border-b text-xs font-bold">
      <span>История изменений</span>
      <button class="cursor-pointer text-muted" @click="$emit('close')">✕</button>
    </div>

    <div class="p-3 border-b">
      <label class="text-xs text-muted">Хранить последних версий:</label>
      <input
        :value="maxSaves"
        type="number"
        class="input-base text-xs w-full mt-1"
        @input="$emit('update:maxSaves', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-3 flex-col gap-2">
      <div v-if="history.length === 0" class="text-xs text-muted text-center">Нет сохраненных версий</div>
      <div
        v-for="h in history"
        :key="h.id"
        class="catalog-item interactive-el"
        :class="{ 'is-previewing': previewId === h.id }"
        @click="$emit('preview', h)"
      >
        <div class="flex justify-between items-center w-full">
          <span class="text-xs font-bold">{{ h.formattedDate }}</span>
          <button
            class="cursor-pointer text-sm text-accent"
            :title="h.is_pinned ? 'Открепить' : 'Закрепить от удаления'"
            @click.stop="$emit('toggle-pin', h)"
          >
            {{ h.is_pinned ? '📌' : '📍' }}
          </button>
        </div>
        <div v-if="previewId === h.id" class="mt-1">
          <span class="text-xs text-warning">Режим предпросмотра</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { SchemaHistoryRecord } from '../hooks/useSchemaHistory';

export type SchemaHistoryItem = SchemaHistoryRecord;

defineProps<{
  maxSaves: number;
  history: SchemaHistoryRecord[];
  previewId: string | null;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'update:maxSaves', val: number): void;
  (e: 'preview', item: SchemaHistoryRecord): void;
  (e: 'toggle-pin', item: SchemaHistoryRecord): void;
}>();
</script>
