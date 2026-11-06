<template>
  <aside class="schema-catalog history-drawer">
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
      >
    </div>

    <div v-if="isLoading" class="p-4 text-center text-muted text-xs">
      Загрузка истории...
    </div>
    <div v-else class="flex-1 overflow-y-auto p-3 flex-col gap-2">
      <div v-if="revisions.length === 0" class="text-xs text-muted text-center">Нет сохраненных версий</div>

      <div
        v-for="(rev, idx) in revisions"
        :key="rev.id"
        class="catalog-item interactive-el"
        :class="{ 'is-previewing': previewingRevId === rev.id }"
        @click="$emit('preview', rev)"
      >
        <div class="flex justify-between items-center w-full">
          <span class="text-xs font-bold">{{ rev.formattedDate }}</span>
          <button
            class="cursor-pointer text-accent text-sm"
            :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'"
            @click.stop="$emit('togglePin', rev)"
          >
            {{ rev.is_pinned ? '📍' : '📌' }}
          </button>
        </div>
        <div class="text-xs text-muted mt-1 diff-summary-text">
          <SafeHtml v-if="getDiffSummary(rev, revisions[idx + 1])" as="span" :content="getDiffSummary(rev, revisions[idx + 1])" />
          <span v-else>Базовая версия</span>
        </div>
        <div v-if="previewingRevId === rev.id" class="mt-1">
          <span class="text-xs preview-badge-warning">Режим предпросмотра</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { SafeHtml } from '@worldwiki/components';
import type { EntityHistoryAsideProps, EntityHistoryAsideEmits } from './EntityHistoryAside.model';

defineProps<EntityHistoryAsideProps>();
defineEmits<EntityHistoryAsideEmits>();
</script>

