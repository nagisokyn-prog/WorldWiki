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
        @toggle="toggleTodoStatus"
        @cycle-status="cycleStatus"
        @save="saveTodo"
        @delete="deleteTodo"
        @navigate="navigateToChapter"
        @toggle-collapse="toggleCollapse"
        @add-todo="addTodo"
        @attach-arc="attachArc"
      />

      <!-- Outlining Action: Add Planned Chapter in Volume -->
      <div class="tapestry-add-chapter-box pt-2 border-t border-border">
        <div v-if="isAddingChapter" class="flex items-center gap-1.5 w-full">
          <input
            ref="chapterInputRef"
            v-model="newChapterTitle"
            class="plan-inline-add-input flex-1"
            placeholder="Название новой главы (например, Глава 3: Побег)..."
            @keydown.enter.prevent="submitAddChapter"
            @keydown.esc="cancelAddChapter"
          />
          <button type="button" class="btn-subtle text-xs px-2 py-1" @click="submitAddChapter">
            Создать
          </button>
          <button type="button" class="btn-subtle text-xs px-2 py-1 text-muted" @click="cancelAddChapter">
            ✕
          </button>
        </div>
        <button
          v-else
          type="button"
          class="btn-add-chapter-stream w-full py-2 px-3 rounded border border-dashed border-border hover:border-accent text-xs text-muted hover:text-accent transition-colors flex items-center justify-center gap-1.5"
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
        @move-to-chapter="moveBacklogToChapter"
        @delete="deleteTodo"
        @add-backlog="addTodo"
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
  addTodo,
  deleteTodo,
  startAddingChapter,
  cancelAddChapter,
  submitAddChapter,
  moveBacklogToChapter,
  attachArc
} = usePlanningPanel(props, (evt, ...args) => {
  if (evt === 'change') emit('change');
  if (evt === 'select-arc') emit('select-arc', (args[0] as string) || null);
});

function navigateToChapter(chapterId: string) {
  emit('select-chapter', chapterId);
}
</script>

<style src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
