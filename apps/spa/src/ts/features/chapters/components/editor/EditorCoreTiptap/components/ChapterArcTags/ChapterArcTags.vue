<template>
  <div class="chapter-arc-tags">
    <!-- Bound Arcs Badges -->
    <div
      v-for="arc in boundArcs"
      :key="arc.arcId"
      class="arc-tag-badge"
      :style="arc.color ? { borderLeftColor: arc.color, borderLeftWidth: '3px' } : {}"
    >
      <span class="arc-icon">⚡</span>
      <span class="arc-title">{{ arc.title }}</span>
      <button
        type="button"
        class="arc-remove-btn"
        title="Отвязать арку от главы"
        @click.stop="detachArc(arc.arcId)"
      >
        ×
      </button>
    </div>

    <!-- Add Arc Button / Dropdown Picker -->
    <div class="popover-anchor">
      <button
        type="button"
        class="btn-add-arc"
        title="Привязать сюжетную арку к главе"
        @click="isPickerOpen = !isPickerOpen"
      >
        <span>＋</span>
        <span>Арка</span>
      </button>

      <!-- Picker Popover -->
      <div
        v-if="isPickerOpen"
        class="arc-picker-popover"
        @click.stop
      >
        <div class="popover-header">
          <span class="popover-title">Сюжетные арки проекта:</span>
          <button
            type="button"
            class="popover-close-btn"
            title="Закрыть"
            @click="isPickerOpen = false"
          >
            ✕
          </button>
        </div>

        <!-- Available Arcs List -->
        <div v-if="availableArcs.length > 0" class="popover-list">
          <button
            v-for="a in availableArcs"
            :key="a.id || ''"
            type="button"
            class="popover-item"
            @click="a.id && attachArc(a.id)"
          >
            <span>⚡ {{ a.title }}</span>
            <span class="popover-item-type">{{ a.arc_type }}</span>
          </button>
        </div>
        <div v-else class="popover-empty">
          Все арки уже привязаны или ещё не созданы
        </div>

        <!-- Quick Create New Arc -->
        <div class="popover-create-box">
          <input
            v-model="newArcTitle"
            type="text"
            placeholder="Новая арка..."
            class="popover-input"
            @keydown.enter.prevent="createAndAttachArc"
          />
          <button
            type="button"
            class="popover-submit-btn"
            :disabled="!newArcTitle.trim() || isCreating"
            title="Создать и привязать"
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

<style scoped src="@worldwiki/resources/styles/features/chapters/ChapterArcTags.css"></style>
