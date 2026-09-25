<template>
  <div class="arc-card p-3 rounded border border-subtle bg-surface hover:bg-surface-hover shadow-xs transition-shadow flex flex-col gap-2 cursor-pointer">
    <div class="flex items-start justify-between gap-2">
      <span class="font-bold text-xs text-main">{{ arc.title }}</span>
      <span class="text-2xs px-1.5 py-0.5 rounded bg-surface-hover text-muted capitalize">
        {{ arc.arc_type }}
      </span>
    </div>

    <p v-if="arc.description" class="text-xs text-muted m-0 line-clamp-2">
      {{ arc.description }}
    </p>

    <!-- Linked Narrative Blocks Chain -->
    <div v-if="linkedBlocks.length > 0" class="arc-blocks-list flex flex-col gap-1 pt-1.5 border-t border-subtle">
      <div class="text-2xs text-muted font-medium flex items-center justify-between">
        <span>Нарративные блоки ({{ linkedBlocks.length }}):</span>
      </div>
      <div
        v-for="block in linkedBlocks"
        :key="block.id || block.quote"
        class="arc-block-item flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-surface-subtle border border-subtle hover:border-accent text-2xs cursor-pointer"
        :title="block.quote ? `«${block.quote}»` : 'Перейти к блоку'"
        @click.stop="$emit('locate', { chapterId: block.chapter_id, paragraphIndex: block.paragraph_index, quote: block.quote, blockId: block.block_id || undefined })"
      >
        <div class="flex items-center gap-1 min-w-0 flex-1">
          <span class="font-medium whitespace-nowrap" :class="getPhaseInfo(block.arc_phase).class">
            {{ getPhaseInfo(block.arc_phase).label }}
          </span>
          <span class="text-muted truncate">
            {{ formatChapterName(block.chapter_id) }} · абз.{{ block.paragraph_index }}
          </span>
        </div>
        <span class="badge-status-micro text-2xs text-muted">
          {{ getPromiseStatusLabel(block.status) }}
        </span>
      </div>
    </div>

    <!-- Card Actions / Move buttons -->
    <div class="flex items-center justify-between pt-2 border-t border-subtle text-2xs text-muted">
      <select
        :value="effectiveStatus"
        class="status-quick-select text-2xs px-1.5 py-0.5 rounded border border-subtle bg-input text-main"
        @change="$emit('update-status', arc, ($event.target as HTMLSelectElement).value as ArcStatus)"
      >
        <option value="planned">Запланировано</option>
        <option value="in_progress">В Процессе</option>
        <option value="completed">Завершено</option>
        <option value="abandoned">Отменено</option>
      </select>

      <button
        class="btn-del hover:text-danger cursor-pointer p-1"
        title="Удалить арку"
        @click.stop="$emit('delete', arc.id)"
      >
        🗑️
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StoryArc } from '@/stores/story_arcs.store';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { ArcStatus } from '../StoryArcs.model';

defineProps<{
  arc: StoryArc;
  effectiveStatus: ArcStatus;
  linkedBlocks: PlotPromise[];
}>();

defineEmits<{
  (e: 'update-status', arc: StoryArc, status: ArcStatus): void;
  (e: 'delete', id?: string | null): void;
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
}>();

const getPhaseInfo = (phase?: string | null) => {
  switch (phase) {
    case 'setup':
      return { label: '🌱 Завязка', class: 'phase-setup' };
    case 'escalation':
      return { label: '⚡ Эскалация', class: 'phase-escalation' };
    case 'climax':
      return { label: '🔥 Кульминация', class: 'phase-climax' };
    case 'resolution':
      return { label: '✅ Развязка', class: 'phase-resolution' };
    default:
      return { label: '🌱 Блок', class: 'phase-default' };
  }
};

const getPromiseStatusLabel = (status: string) => {
  switch (status) {
    case 'planted':
      return '🌱 Заложено';
    case 'developed':
      return '⚡ Развитие';
    case 'resolved':
      return '✅ Разрешено';
    case 'abandoned':
      return '🛑 Отменено';
    default:
      return status;
  }
};

const formatChapterName = (chapterId: string) => {
  return chapterId.replace(/^chapters:/, 'Гл. ');
};
</script>
