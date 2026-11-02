<template>
  <div class="volume-backlog-section">
    <!-- Header -->
    <div
      class="backlog-header flex items-center justify-between cursor-pointer py-2 px-1 border-t border-border"
      @click="toggleExpanded"
    >
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span class="text-xs text-muted">{{ isExpanded ? '▼' : '▸' }}</span>
        <span class="backlog-icon">💡</span>
        <span class="backlog-title font-semibold text-xs text-main">
          Идеи и бэклог тома (не привязаны к главам)
        </span>
      </div>
      <span class="text-xs text-muted font-medium">({{ items.length }})</span>
    </div>

    <!-- Items List (when expanded) -->
    <div v-if="isExpanded" class="backlog-content flex flex-col gap-2 mt-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="backlog-item-row flex items-center justify-between gap-2 p-1.5 rounded bg-secondary"
      >
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <span class="text-xs text-muted">▫️</span>
          <span class="text-xs text-main truncate" :title="item.text">{{ item.text }}</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            v-if="currentChapterId"
            type="button"
            class="btn-subtle text-[11px] px-2 py-0.5 rounded text-accent hover:bg-hover"
            title="Перенести эту задачу в текущую главу"
            @click="$emit('move-to-chapter', item.id)"
          >
            В текущую главу ➔
          </button>
          <button
            type="button"
            class="text-xs text-muted hover:text-danger px-1"
            title="Удалить"
            @click="$emit('delete', item)"
          >
            ×
          </button>
        </div>
      </div>

      <div v-if="items.length === 0" class="text-xs text-muted italic px-2 py-1">
        Бэклог тома пуст. Записывайте сюда мысли, которые пока не распределены по конкретным главам.
      </div>

      <!-- Add to Backlog -->
      <div class="mt-1">
        <div v-if="isAdding" class="flex items-center gap-1.5 w-full">
          <input
            ref="inputRef"
            v-model="newText"
            class="plan-inline-add-input flex-1"
            placeholder="Записать мысль или задумку в бэклог тома..."
            @keydown.enter.prevent="submitAdd"
            @keydown.esc="cancelAdd"
          />
          <button type="button" class="btn-subtle text-xs px-2 py-1" @click="submitAdd">ОК</button>
          <button type="button" class="btn-subtle text-xs px-2 py-1 text-muted" @click="cancelAdd">✕</button>
        </div>
        <button
          v-else
          type="button"
          class="btn-add-backlog text-xs text-muted hover:text-main flex items-center gap-1 py-1 px-2 rounded"
          @click="startAdding"
        >
          <span>＋</span> Записать мысль в бэклог тома
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VolumeBacklogSectionProps, VolumeBacklogSectionEmits } from './VolumeBacklogSection.model';
import { useVolumeBacklogSection } from './useVolumeBacklogSection';

const props = defineProps<VolumeBacklogSectionProps>();
const emit = defineEmits<VolumeBacklogSectionEmits>();

const {
  isExpanded,
  isAdding,
  newText,
  inputRef,
  toggleExpanded,
  startAdding,
  cancelAdd,
  submitAdd
} = useVolumeBacklogSection(props, emit);
</script>
