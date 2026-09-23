<template>
  <div class="chapters-view-container" :class="{ 'zen-mode-active': isZenMode }">
    
    <!-- MAIN AREA -->
    <div v-if="currentChapter" class="flex-1 flex overflow-hidden min-w-0">
      
      <!-- Editor Core -->
      <EditorCore
        ref="editorCoreRef"
        v-model:title="currentChapter.title"
        v-model:content="currentChapter.content"
        :project="project"
        :has-unsaved-changes="hasUnsavedChanges"
        :footnotes-data="currentChapter.footnotes || undefined"
        :changed-fields="changedFields"
        :existing-promises="rightSidebarRef?.promisesPanelRef?.promises || []"
        @update:title="markUnsaved"
        @update:content="markUnsaved"
        @change="markUnsaved"
        @save="triggerSave"
        @open-entity="handleOpenEntity"
        @scroll-change="handleScrollChange"
        @toggle-history="toggleHistory"
        @add-participant="handleAddParticipant"
        @create-promise="handleCreatePromise"
        @link-milestone="handleLinkMilestone"
      />

      <!-- Right Panel Resizer -->
      <div v-if="isRightPanelVisible" class="panel-resize-handle" @mousedown="startResize"></div>

      <!-- Right Sidebar Component -->
      <ChapterRightSidebar
        ref="rightSidebarRef"
        :project="project"
        :is-visible="isRightPanelVisible"
        :width="rightPanelWidth"
        :active-tree-node="localActiveTreeNode"
        :current-chapter="currentChapter"
        :current-volume="currentVolume"
        :current-chapter-id="currentChapterId"
        :chapters="chapters"
        :is-timeline-open="isTimelineOpen"
        :is-participants-open="isParticipantsOpen"
        :is-volume-plan-open="isVolumePlanOpen"
        :is-chapter-plan-open="isChapterPlanOpen"
        @toggle-timeline="isTimelineOpen = !isTimelineOpen"
        @toggle-participants="isParticipantsOpen = !isParticipantsOpen"
        @toggle-volume-plan="isVolumePlanOpen = !isVolumePlanOpen"
        @toggle-chapter-plan="isChapterPlanOpen = !isChapterPlanOpen"
        @add-volume-plan-item="addVolumePlanItem"
        @add-chapter-plan-item="addChapterPlanItem"
        @update:timeline-events="currentChapter && (currentChapter.timeline_events = $event)"
        @update:participants="currentChapter && (currentChapter.participants = $event)"
        @mark-unsaved="markUnsaved"
        @locate-promise="handleLocatePromise"
      />
      
      <!-- History Drawer Component -->
      <ChaptersHistoryDrawer
        v-model:max-saves="maxSaves"
        :is-open="showHistory"
        :is-loading="isLoadingHistory"
        :revisions="revisions"
        :previewing-rev-id="previewingRevId"
        :get-diff-summary="getDiffSummary"
        @close="showHistory = false"
        @preview="previewHistory"
        @toggle-pin="togglePin"
      />
    </div>
    
    <div v-else class="flex-1 flex-col flex-center text-muted">
      <div class="text-2xl mb-3 icon-dim">📖</div>
      <div class="text-base">Выберите главу для редактирования</div>
    </div>

    <!-- QuickLink Floating Helper -->
    <QuickLinkHint
      :is-open="showQuickLinkHint"
      :hide-forever="hideQuickLinkHintForever"
      @open="showQuickLinkHint = true"
      @close="showQuickLinkHint = false"
      @dismiss-forever="dismissQuickLinkHintForever"
    />

    <!-- Modals & Drawers -->
    <ExportModal 
      :is-open="isExportModalOpen" 
      :all-chapters="chapters"
      :current-chapter-id="currentChapterId || undefined"
      @close="isExportModalOpen = false"
      @export="handleExport"
    />

    <!-- Floating Entity Editors -->
    <FloatingEntityEditor
      v-for="editor in floatingEditors"
      :key="editor.id"
      :project="editor.project"
      :entity-type="editor.type"
      :entity-id="editor.entityId"
      :is-open="true"
      @close="closeFloatingEditor(editor.id)"
      @focus="() => {}"
      @saved="() => {}"
    />

    <!-- Debug Panel -->
    <div v-if="debugError" class="fixed card-secondary z-tooltip p-3 font-mono text-xs debug-error-panel">
      <div class="flex justify-between mb-2">
        <strong>⚠️ Ошибка</strong>
        <button class="cursor-pointer text-main" @click="debugError = null">✕</button>
      </div>
      <div class="debug-error-message">{{ debugError }}</div>
      <div class="mt-2 text-muted">Проект: {{ project }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EditorCore from '../EditorCoreTiptap/EditorCoreTiptap.vue';
import ExportModal from '../Export/ExportModal.vue';
import FloatingEntityEditor from '../../entities/FloatingEntityEditor.vue';
import ChapterRightSidebar from './components/ChapterRightSidebar.vue';
import ChaptersHistoryDrawer from './components/ChaptersHistoryDrawer.vue';
import QuickLinkHint from './components/QuickLinkHint.vue';
import { useChaptersMain } from './useChaptersMain';
import type { ActiveTreeNode, ChapterTreeNode } from './useChaptersMain';

const props = withDefaults(defineProps<{
  project: string;
  controlledChapterId?: string | null;
  activeTreeNode?: ActiveTreeNode | null;
}>(), {
  controlledChapterId: null,
  activeTreeNode: null
});

const emit = defineEmits<{
  'open-chapter-as-tab': [chapter: ChapterTreeNode];
  'chapter-unsaved': [];
  'chapter-saved': [];
  'chapter-renamed': [payload: { id: string; title: string }];
  'scroll-change': [scroll: number];
}>();

const rightSidebarRef = ref<InstanceType<typeof ChapterRightSidebar> | null>(null);

const {
  chapters, currentChapterId, currentChapter,
  currentVolume, isVolumePlanOpen,
  isChapterPlanOpen,
  addVolumePlanItem, addChapterPlanItem,
  hasUnsavedChanges, localActiveTreeNode, debugError,
  isExportModalOpen, showQuickLinkHint, isZenMode, floatingEditors, showHistory,
  isLoadingHistory, revisions, previewingRevId, maxSaves, toggleHistory,
  previewHistory, togglePin, getDiffSummary, changedFields,
  rightPanelWidth, isRightPanelVisible, triggerSave,
  closeFloatingEditor, startResize,
  hideQuickLinkHintForever, dismissQuickLinkHintForever,
  markUnsaved, handleOpenEntity,
  handleExport, handleScrollChange, handleAddParticipant,
  editorCoreRef, isTimelineOpen, isParticipantsOpen,
  handleCreatePromise, handleLinkMilestone, handleLocatePromise
} = useChaptersMain({
  project: props.project,
  controlledChapterId: props.controlledChapterId || undefined,
  activeTreeNode: props.activeTreeNode || undefined
}, emit as (event: string, ...args: unknown[]) => void);
</script>

<style src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css" scoped></style>
