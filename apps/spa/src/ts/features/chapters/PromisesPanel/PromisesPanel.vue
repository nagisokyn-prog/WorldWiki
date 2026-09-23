<template>
  <div class="tool-section promises-section">
    <div class="section-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <span class="collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
        <span class="font-bold text-sm">🎯 Сюжетные обещания</span>
        <span v-if="promises.length > 0" class="badge badge-subtle">
          {{ promises.length }}
        </span>
      </div>
      <button 
        class="btn-icon-subtle text-xs" 
        title="Обновить список" 
        @click.stop="loadPromises"
      >
        🔄
      </button>
    </div>

    <div
      v-show="!isCollapsed"
      class="section-content"
      :style="{ height: promisesHeight + 'px' }"
    >
      <!-- Фильтры: Область видимости и статус -->
      <PromiseFilterBar
        v-model:scope-filter="scopeFilter"
        v-model:status-filter="statusFilter"
        :total-count="promises.length"
        :chapter-count="chapterPromises.length"
        :statuses="PROMISE_STATUSES"
      />

      <div v-if="loading" class="text-xs text-muted p-2 text-center">
        Загрузка обещаний...
      </div>

      <div v-else-if="filteredPromises.length === 0" class="empty-state">
        <div class="text-xs text-muted">
          {{ scopeFilter === 'current' ? 'В текущей главе нет сюжетных обещаний.' : 'В проекте пока нет сюжетных обещаний.' }}
          <br />
          Выделите текст и нажмите <kbd class="kbd-hint">ПКМ</kbd>, чтобы добавить или развить.
        </div>
      </div>

      <div v-else class="promises-list">
        <PromiseCard
          v-for="item in filteredPromises" 
          :key="item.id || item.quote"
          :item="item"
          :kind-info="getKindInfo(item.kind)"
          :editing-note-id="editingNoteId"
          :note-draft="noteDraft"
          :get-chapter-title="getChapterTitle"
          :is-current-chapter-promise="isCurrentChapterPromise"
          @update:note-draft="noteDraft = $event"
          @remove="removePromise"
          @locate="locateSource"
          @remove-milestone="removeMilestone($event.item, $event.milestoneId, $event.stage)"
          @prompt-attach-milestone="promptAttachMilestone($event.item, $event.stage)"
          @start-edit-note="startEditNote"
          @cancel-edit-note="cancelEditNote"
          @save-note="saveNote"
        />
      </div>
    </div>

    <div
      v-show="!isCollapsed"
      class="panel-resize-handle-vertical"
      :class="{ 'is-resizing': isResizing }"
      title="Потяните для изменения высоты"
      @mousedown="startVerticalResize"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { usePromisesPanel, PROMISE_STATUSES } from './usePromisesPanel';
import type { PromisesPanelProps } from './usePromisesPanel';
import PromiseFilterBar from './components/PromiseFilterBar.vue';
import PromiseCard from './components/PromiseCard.vue';

const props = defineProps<PromisesPanelProps>();

const emit = defineEmits<{
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
  (e: 'change'): void;
}>();

const {
  isCollapsed,
  promises,
  chapterPromises,
  filteredPromises,
  loading,
  editingNoteId,
  noteDraft,
  scopeFilter,
  statusFilter,
  loadPromises,
  addPromise,
  addMilestone,
  removeMilestone,
  startEditNote,
  saveNote,
  cancelEditNote,
  removePromise,
  locateSource,
  getKindInfo,
  getChapterTitle,
  isCurrentChapterPromise,
  promptAttachMilestone,
  promisesHeight,
  isResizing,
  startVerticalResize
} = usePromisesPanel(props, emit);

defineExpose({
  promises,
  addPromise,
  addMilestone,
  loadPromises
});
</script>

<style src="@worldwiki/resources/styles/features/chapters/PromisesPanel.css"></style>
<style src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>
