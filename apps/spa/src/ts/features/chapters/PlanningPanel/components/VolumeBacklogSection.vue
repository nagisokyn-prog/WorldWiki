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
          <!-- Move to any chapter dropdown -->
          <div class="relative">
            <button
              type="button"
              class="btn-subtle text-[11px] px-2 py-0.5 rounded text-accent hover:bg-hover flex items-center gap-1"
              title="Перенести задачу в главу"
              @click.stop="toggleMoveMenu(item.id)"
            >
              <span>В главу ➔</span>
            </button>
            <div
              v-if="activeMoveItemId === item.id"
              class="chapter-move-dropdown absolute right-0 bottom-full mb-1 z-50 bg-secondary border border-border rounded shadow-lg p-1 min-w-48 max-h-52 overflow-y-auto flex flex-col gap-0.5"
              @click.stop
            >
              <div class="px-2 py-1 text-[10px] font-semibold text-muted uppercase">Перенести в главу:</div>
              <button
                v-for="ch in chapters"
                :key="ch.chapterId"
                type="button"
                class="text-left text-xs px-2 py-1 rounded hover:bg-hover text-main truncate flex items-center justify-between"
                :class="{ 'font-semibold text-accent': ch.chapterId === currentChapterId }"
                @click="moveToChapter(item.id, ch.chapterId)"
              >
                <span class="truncate">{{ ch.title }}</span>
                <span v-if="ch.chapterId === currentChapterId" class="text-[10px] text-accent ml-1 shrink-0">(тек.)</span>
              </button>
              <div v-if="!chapters || chapters.length === 0" class="text-xs text-muted p-2 text-center">
                Нет доступных глав
              </div>
            </div>
          </div>

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
  activeMoveItemId,
  toggleExpanded,
  startAdding,
  cancelAdd,
  submitAdd,
  toggleMoveMenu,
  closeMoveMenu,
  moveToChapter
} = useVolumeBacklogSection(props, emit);
</script>
