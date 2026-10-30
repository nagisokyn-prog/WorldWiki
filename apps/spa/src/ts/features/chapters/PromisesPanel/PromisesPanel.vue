<template>
  <div class="tool-section promises-section flex-1 min-h-0 flex flex-col">
    <div class="section-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <span class="font-bold text-sm">🎯 Сцены & Блоки</span>
        <span v-if="promises.length > 0" class="badge badge-subtle">
          {{ promises.length }}
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <button 
          class="btn-icon-subtle text-xs" 
          title="Открыть путь персонажа и навигатор сцен" 
          @click.stop="$emit('open-journey')"
        >
          🗺️
        </button>
        <button 
          class="btn-xs btn-outline" 
          title="Добавить новую сцену" 
          @click.stop="addNewScene"
        >
          ＋ Сцена
        </button>
        <button 
          class="btn-icon-subtle text-xs" 
          title="Обновить список" 
          @click.stop="loadPromises"
        >
          🔄
        </button>
      </div>
    </div>

    <div
      v-show="!isCollapsed"
      class="section-content flex-1 min-h-0"
    >
      <!-- Фильтры: Область видимости, категория и статус -->
      <PromiseFilterBar
        v-model:scope-filter="scopeFilter"
        v-model:status-filter="statusFilter"
        v-model:category-filter="categoryFilter"
        :total-count="promises.length"
        :chapter-count="chapterPromises.length"
        :statuses="PROMISE_STATUSES"
      />

      <div v-if="loading" class="text-xs text-muted p-2 text-center">
        Загрузка обещаний...
      </div>

      <div v-else-if="filteredPromises.length === 0" class="empty-state">
        <div class="text-xs text-muted">
          {{ scopeFilter === 'current' ? 'В текущей главе нет сюжетных блоков.' : 'В проекте пока нет сюжетных блоков.' }}
          <br />
          Выделите текст и нажмите <kbd class="kbd-hint">ПКМ</kbd>, чтобы добавить сцену, конфликт или обещание.
        </div>
      </div>

      <div v-else class="promises-list">
        <PromiseCard
          v-for="item in filteredPromises" 
          :key="item.id || item.quote"
          :project="project"
          :item="item"
          :kind-info="getKindInfo(item.kind)"
          :editing-note-id="editingNoteId"
          :note-draft="noteDraft"
          :get-chapter-title="getChapterTitle"
          :is-current-chapter-promise="isCurrentChapterPromise"
          @update:item="updatePromise"
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

    
  </div>
</template>

<script setup lang="ts">
import type { PromisesPanelProps, PromisesPanelEmits } from './PromisesPanel.model';
import { usePromisesPanel, PROMISE_STATUSES } from './usePromisesPanel';
import type { PromisesPanelProps } from './usePromisesPanel';
import PromiseFilterBar from './components/PromiseFilterBar.vue';
import PromiseCard from './components/PromiseCard.vue';

const props = defineProps<PromisesPanelProps>();

const emit = defineEmits<PromisesPanelEmits>>();

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
  categoryFilter,
  loadPromises,
  addPromise,
  addNewScene,
  updatePromise,
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
  promptAttachMilestone
} = usePromisesPanel(props, emit);

defineExpose({
  promises,
  addPromise,
  addNewScene,
  updatePromise,
  addMilestone,
  loadPromises
});
</script>

<style src="@worldwiki/resources/styles/features/chapters/PromisesPanel.css"></style>
<style src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>


