<template>
  <div class="chapter-arc-tags flex items-center flex-wrap gap-1.5 py-1">
    <!-- Bound Arcs Badges -->
    <div
      v-for="arc in boundArcs"
      :key="arc.arcId"
      class="arc-tag-badge flex items-center gap-1 px-2 py-0.5 rounded text-xs border"
      :style="arc.color ? { borderColor: arc.color, backgroundColor: `${arc.color}15` } : {}"
    >
      <span class="arc-icon">⚡</span>
      <span class="arc-title font-medium">{{ arc.title }}</span>
      <button
        class="arc-remove-btn text-muted hover:text-danger ml-0.5"
        title="Отвязать арку от главы"
        @click.stop="detachArc(arc.arcId)"
      >
        ×
      </button>
    </div>

    <!-- Add Arc Button / Dropdown Picker -->
    <div class="relative inline-block">
      <button
        class="btn-add-arc flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-dashed border-border hover:border-accent hover:text-accent transition-colors text-muted"
        title="Привязать сюжетную арку"
        @click="isPickerOpen = !isPickerOpen"
      >
        <span>＋</span>
        <span>Арка</span>
      </button>

      <!-- Picker Popover -->
      <div
        v-if="isPickerOpen"
        class="arc-picker-popover absolute left-0 top-full mt-1 w-56 p-2 rounded shadow-lg border border-border bg-panel z-50 flex flex-col gap-2"
        @click.stop
      >
        <div class="text-xs font-semibold text-muted">Сюжетные арки проекта:</div>

        <!-- Available Arcs List -->
        <div v-if="availableArcs.length > 0" class="max-h-32 overflow-y-auto flex flex-col gap-1">
          <button
            v-for="a in availableArcs"
            :key="a.id || ''"
            class="text-left px-2 py-1 rounded text-xs hover:bg-hover text-main flex items-center justify-between"
            @click="a.id && attachArc(a.id)"
          >
            <span>⚡ {{ a.title }}</span>
            <span class="text-[10px] text-muted">{{ a.arc_type }}</span>
          </button>
        </div>
        <div v-else class="text-[11px] text-muted italic px-1">
          Все арки уже привязаны или ещё не созданы
        </div>

        <!-- Quick Create New Arc -->
        <div class="border-t border-border pt-1.5 flex gap-1">
          <input
            v-model="newArcTitle"
            type="text"
            placeholder="Новая арка..."
            class="flex-1 px-1.5 py-0.5 text-xs bg-input border border-border rounded text-main"
            @keydown.enter.prevent="createAndAttachArc"
          />
          <button
            class="px-2 py-0.5 text-xs bg-primary text-white rounded font-medium disabled:opacity-50"
            :disabled="!newArcTitle.trim() || isCreating"
            @click="createAndAttachArc"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChapterArcTags } from './useChapterArcTags';
import type { ChapterArcTagsProps, ChapterArcTagsEmits } from './ChapterArcTags.model';

const props = defineProps<ChapterArcTagsProps>();
const emit = defineEmits<ChapterArcTagsEmits>();

const {
  isPickerOpen,
  newArcTitle,
  isCreating,
  boundArcs,
  availableArcs,
  attachArc,
  detachArc,
  createAndAttachArc
} = useChapterArcTags(props, emit);
</script>

<style scoped>
.chapter-arc-tags {
  min-height: 24px;
}

.arc-tag-badge {
  background: var(--bg-sunken);
  border-color: var(--border-color);
  color: var(--text-main);
  transition: border-color var(--anim-speed-fast, 0.15s) ease, background-color var(--anim-speed-fast, 0.15s) ease;
}


.arc-tag-badge:hover {
  border-color: var(--accent);
}

.arc-remove-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-size: var(--font-size-sm, 13px);
  line-height: 1;
}

.arc-picker-popover {
  background: var(--bg-panel);
  border-color: var(--border-color);
  box-shadow: var(--shadow-dropdown);
}
</style>
