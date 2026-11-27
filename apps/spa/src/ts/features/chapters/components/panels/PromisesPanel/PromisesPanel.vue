<template>
  <div class="tool-section promises-section flex-1 min-h-0 flex flex-col">
    <div class="section-header gap-1.5">
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="font-bold text-sm">🎯 Сцены & Блоки</span>
        <span v-if="promises.length > 0" class="badge badge-subtle">
          {{ promises.length }}
        </span>
      </div>
      <div class="relative flex-1 min-w-[80px] max-w-[180px]">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full px-2 py-0.5 text-xs bg-surface border border-border-subtle rounded focus:outline-none focus:border-accent"
          placeholder="🔍 Поиск..."
          title="Поиск сцен и блоков (Enter — перейти к первому)"
          @keydown.enter.prevent="locateFirstFiltered"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-1 top-1/2 -translate-y-1/2 text-2xs text-muted hover:text-main"
          title="Очистить поиск"
          @click.stop="searchQuery = ''"
        >
          ✕
        </button>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          v-if="filteredPromises.length > 0"
          class="btn-icon-subtle text-xs"
          title="Развернуть все карточки"
          @click.stop="expandAllCards"
        >
          ⊞
        </button>
        <button
          v-if="filteredPromises.length > 0"
          class="btn-icon-subtle text-xs"
          title="Свернуть все карточки"
          @click.stop="collapseAllCards"
        >
          ⊟
        </button>
        <button 
          class="btn-icon-subtle text-xs" 
          title="Открыть путь персонажа и навигатор сцен" 
          @click.stop="$emit('open-journey')"
        >
          🗺️
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
        <div v-for="group in displayGroups" :key="group.chapterId" :class="group.showHeader ? 'chapter-folder-group mb-2' : ''">
          <button
            v-if="group.showHeader"
            type="button"
            class="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold bg-surface-subtle hover:bg-hover border border-border-subtle rounded mb-1 text-left"
            @click="toggleChapterGroup(group.chapterId)"
          >
            <span class="flex items-center gap-1.5 truncate">
              <span class="text-2xs text-muted">{{ group.isCollapsed ? '▶' : '▼' }}</span>
              <span>📁 {{ group.title }}</span>
              <span v-if="group.isCurrent" class="badge-current-chapter">текущая</span>
            </span>
            <span class="badge badge-subtle">{{ group.items.length }}</span>
          </button>
          <div v-if="!group.isCollapsed" :class="group.showHeader ? 'flex flex-col gap-1.5 pl-1' : 'flex flex-col gap-1.5'">
            <PromiseCard
              v-for="(item, idx) in group.items"
              :key="item.id || item.quote"
              :project="project"
              :item="item"
              :kind-info="getKindInfo(item.kind)"
              :editing-note-id="editingNoteId"
              :note-draft="noteDraft"
              :get-chapter-title="getChapterTitle"
              :is-current-chapter-promise="isCurrentChapterPromise"
              :expanded="isCardExpanded(item.id)"
              :previous-scene="idx > 0 ? group.items[idx - 1] : null"
              :shared-entities="sharedEntities"
              @toggle-expand="toggleCardExpanded(item.id)"
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
    </div>

    
  </div>
</template>

<script setup lang="ts">
import type { PromisesPanelProps, PromisesPanelEmits } from './PromisesPanel.model';
import { usePromisesPanel, PROMISE_STATUSES } from './usePromisesPanel';
import PromiseFilterBar from './components/PromiseFilterBar/PromiseFilterBar.vue';
import PromiseCard from './components/PromiseCard/PromiseCard.vue';

const props = defineProps<PromisesPanelProps>();

const emit = defineEmits<PromisesPanelEmits>();

const {
  isCollapsed, sharedEntities, isCardExpanded, toggleCardExpanded, expandAllCards, collapseAllCards,
  promises, chapterPromises, filteredPromises, displayGroups, toggleChapterGroup, loading,
  editingNoteId, noteDraft, scopeFilter, statusFilter, categoryFilter, searchQuery, locateFirstFiltered,
  loadPromises, addPromise, addNewScene, addSubScene, updatePromise, addMilestone, removeMilestone,
  startEditNote, saveNote, cancelEditNote, removePromise, locateSource, getKindInfo,
  getChapterTitle, isCurrentChapterPromise, promptAttachMilestone
} = usePromisesPanel(props, emit);

defineExpose({ promises, addPromise, addNewScene, addSubScene, updatePromise, addMilestone, loadPromises });
</script>

<style src="@worldwiki/resources/styles/features/chapters/PromisesPanel.css"></style>
<style src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>


