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
        :chapter-id="currentChapterId"
        :has-unsaved-changes="hasUnsavedChanges"
        :is-locked="Boolean(previewingRevId)"
        :footnotes-data="currentChapter.footnotes || undefined"
        :changed-fields="changedFields"
        :existing-promises="rightSidebarRef?.promises || []"
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
        @link-subscene="handleLinkSubScene"
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
        @open-journey="openJourney"
      />
      
      <!-- History Drawer Component -->
      <ChaptersHistoryDrawer
        v-model:max-saves="maxSaves"
        :is-open="showHistory"
        :is-loading="isLoadingHistory"
        :revisions="revisions"
        :previewing-rev-id="previewingRevId"
        :get-diff-summary="getDiffSummary"
        @close="closeHistory"
        @preview="previewHistory"
        @restore="restoreRevision"
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
    <component
      :is="'FloatingEntityEditor'"
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

    <!-- Floating Character Journey & Scene Navigator -->
    <FloatingWindow
      v-if="isJourneyOpen"
      title="🗺️ Навигатор Сцен & Путь Персонажа"
      :is-open="isJourneyOpen"
      @close="closeJourney"
    >
      <div class="journey-modal-wrapper" style="width: 100%; height: 100%; min-width: 760px; min-height: 540px; display: flex; flex-direction: column; overflow: hidden;">
        <component
          :is="'CharacterJourney'"
          :project-id="project"
          class="flex-1"
          @select-scene="handleJourneySelectScene"
        />
      </div>
    </FloatingWindow>

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
import type { ChaptersMainProps, ChaptersMainEmits } from './ChaptersMain.model';
import { FloatingWindow } from '@worldwiki/components';
import EditorCore from '@/features/chapters/components/editor/EditorCoreTiptap/EditorCoreTiptap.vue';
import ExportModal from '@/features/chapters/components/modals/ExportModal/ExportModal.vue';
import ChapterRightSidebar from './components/ChapterRightSidebar/ChapterRightSidebar.vue';
import ChaptersHistoryDrawer from './components/ChaptersHistoryDrawer/ChaptersHistoryDrawer.vue';
import QuickLinkHint from './components/QuickLinkHint/QuickLinkHint.vue';
import { useChaptersMain } from './useChaptersMain';


const props = withDefaults(defineProps<ChaptersMainProps>(), {
  controlledChapterId: null,
  activeTreeNode: null
});

const emit = defineEmits<ChaptersMainEmits>();

const {
  chapters, currentChapterId, currentChapter,
  currentVolume, isVolumePlanOpen,
  isChapterPlanOpen,
  addVolumePlanItem, addChapterPlanItem,
  hasUnsavedChanges, localActiveTreeNode, debugError,
  isExportModalOpen, showQuickLinkHint, isZenMode, floatingEditors, showHistory,
  isLoadingHistory, revisions, previewingRevId, maxSaves, toggleHistory,
  closeHistory, restoreRevision,
  previewHistory, togglePin, getDiffSummary, changedFields,
  rightPanelWidth, isRightPanelVisible, triggerSave,
  closeFloatingEditor, startResize,
  hideQuickLinkHintForever, dismissQuickLinkHintForever,
  markUnsaved, handleOpenEntity,
  handleExport, handleScrollChange, handleAddParticipant,
  editorCoreRef, rightSidebarRef, isTimelineOpen, isParticipantsOpen,
  isJourneyOpen, openJourney, closeJourney, handleJourneySelectScene,
  handleCreatePromise, handleLinkMilestone, handleLinkSubScene, handleLocatePromise
} = useChaptersMain({
  project: props.project,
  controlledChapterId: props.controlledChapterId || undefined,
  activeTreeNode: props.activeTreeNode || undefined
}, emit as (event: string, ...args: unknown[]) => void);
</script>


<style src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css" scoped></style>
