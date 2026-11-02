<template>
  <div class="planning-panel flex flex-col h-full min-h-0 overflow-hidden">
    <!-- Volume Progress Header with Collapse Toggle -->
    <PlanVolumeHeader
      :title="volumeTitle"
      :stats="volumeStats"
      :is-collapsed="isVolumeCollapsed"
      @toggle-collapse="toggleVolumeCollapse"
    />

    <!-- Tapestry Scrollable Stream (Collapsible under volume) -->
    <div
      v-show="!isVolumeCollapsed"
      class="tapestry-stream flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0"
    >
      <!-- Loading State -->
      <div v-if="loading && chaptersList.length === 0" class="text-xs text-muted text-center py-6">
        Загрузка ткани сюжета...
      </div>

      <!-- Render Chapters Stream -->
      <TapestryChapterCard
        v-for="chapter in chaptersList"
        :key="chapter.chapterId"
        :chapter="chapter"
        :all-project-arcs="allProjectArcs"
        :all-todos="allVolumeTodos"
        @toggle="toggleTodoStatus"
        @cycle-status="cycleStatus"
        @save="saveTodo"
        @delete="deleteTodo"
        @navigate="handleNavigate"
        @toggle-collapse="toggleCollapse"
        @add-todo="addTodo"
        @attach-arc="attachArc"
        @set-dependency="setDependency"
      />

      <!-- Outlining Action: Add Planned Chapter in Volume -->
      <div class="tapestry-add-chapter-box">
        <div v-if="isAddingChapter" class="plan-inline-add-row">
          <input
            ref="chapterInputRef"
            v-model="newChapterTitle"
            class="plan-inline-add-input"
            style="flex: 1;"
            placeholder="Название новой главы (например, Глава 3: Побег)..."
            @keydown.enter.prevent="submitAddChapter"
            @keydown.esc="cancelAddChapter"
          />
          <button type="button" class="btn-subtle" @click="submitAddChapter">
            Создать
          </button>
          <button type="button" class="btn-subtle" style="color: var(--text-muted);" @click="cancelAddChapter">
            ✕
          </button>
        </div>
        <button
          v-else
          type="button"
          class="btn-add-chapter-stream"
          @click="startAddingChapter"
        >
          <span>＋</span> Запланировать следующую главу в томе
        </button>
      </div>

      <!-- Volume Backlog Ideas Section -->
      <VolumeBacklogSection
        :items="backlogTodos"
        :volume-id="resolvedVolumeId"
        :current-chapter-id="currentChapterId"
        :chapters="chaptersList"
        @move-to-chapter="moveBacklogToChapter"
        @delete="deleteTodo"
        @add-backlog="addBacklog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanningPanelProps, PlanningPanelEmits } from './PlanningPanel.model';
import { usePlanningPanel } from './usePlanningPanel';
import PlanVolumeHeader from './components/PlanVolumeHeader.vue';
import TapestryChapterCard from './components/TapestryChapterCard.vue';
import VolumeBacklogSection from './components/VolumeBacklogSection.vue';

const props = withDefaults(defineProps<PlanningPanelProps>(), {
  project: undefined,
  volumeId: null,
  volumeTitle: '',
  currentChapterId: null,
  currentChapterTitle: '',
  arcsList: () => [],
  selectedArcFilter: null
});

const emit = defineEmits<PlanningPanelEmits>();

const {
  loading,
  chaptersList,
  backlogTodos,
  allProjectArcs,
  allVolumeTodos,
  handleNavigate,
  volumeTitle,
  volumeStats,
  resolvedVolumeId,
  isVolumeCollapsed,
  isAddingChapter,
  newChapterTitle,
  chapterInputRef,
  toggleCollapse,
  toggleVolumeCollapse,
  toggleTodoStatus,
  cycleStatus,
  saveTodo,
  setDependency,
  addTodo,
  addBacklog,
  deleteTodo,
  startAddingChapter,
  cancelAddChapter,
  submitAddChapter,
  moveBacklogToChapter,
  attachArc
} = usePlanningPanel(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
