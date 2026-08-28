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
        :footnotes-data="currentChapter.footnotes"
        :changed-fields="changedFields"
        @update:title="markUnsaved"
        @update:content="markUnsaved"
        @change="markUnsaved"
        @save="triggerSave"
        @open-entity="handleOpenEntity"
        @scroll-change="handleScrollChange"
        @toggle-history="toggleHistory"
        @add-participant="handleAddParticipant"
        @create-promise="handleCreatePromise"
      />

      <!-- Right Panel Resizer -->
      <div v-if="isRightPanelVisible" class="panel-resize-handle" @mousedown="startResize"></div>

      <!-- Right Panel -->
      <div v-if="isRightPanelVisible" class="chapter-right-panel flex-shrink-0" :style="{ width: rightPanelWidth + 'px', minWidth: '200px', maxWidth: '600px' }">

        <!-- Том или Арка выбрана: показываем только план -->
        <div v-if="localActiveTreeNode && localActiveTreeNode.type !== 'chapter'" class="flex-1 flex-col overflow-hidden">
          <PlanningPanel
            :project="project"
            :parent-type="localActiveTreeNode.type"
            :parent-id="localActiveTreeNode.node.id"
            :parent-title="localActiveTreeNode.node.title"
          />
        </div>

        <!-- Глава открыта: таймлайн → участники → обещания (скролл) + зафиксированные планы внизу -->
        <div v-else-if="currentChapter" class="flex-1 flex-col overflow-hidden">
          <div class="chapter-panels-scroll flex-1 overflow-y-auto p-3 flex-col gap-3">
            
            <!-- Аккордеон: Таймлайн -->
            <div class="panel-collapsible-wrapper">
              <div class="panel-header-bar" @click="isTimelineOpen = !isTimelineOpen">
                <span class="panel-header-title">
                  <i class="fas fa-calendar-alt text-accent mr-1"></i> Таймлайн главы
                </span>
                <span class="panel-header-arrow" :style="{ transform: isTimelineOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
              </div>
              <div v-show="isTimelineOpen" class="panel-body-box">
                <TimelinePanel
                  v-model:events="currentChapter.timeline_events"
                  :project="project"
                  @change="markUnsaved"
                />
              </div>
            </div>

            <!-- Аккордеон: Участники -->
            <div class="panel-collapsible-wrapper">
              <div class="panel-header-bar" @click="isParticipantsOpen = !isParticipantsOpen">
                <span class="panel-header-title">
                  <i class="fas fa-users text-accent mr-1"></i> Участники
                </span>
                <span class="panel-header-arrow" :style="{ transform: isParticipantsOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
              </div>
              <div v-show="isParticipantsOpen" class="panel-body-box">
                <ParticipantsPanel
                  v-model:participants="currentChapter.participants"
                  :project="project"
                  @change="markUnsaved"
                />
              </div>
            </div>

            <!-- Сюжетные обещания -->
            <PromisesPanel
              ref="promisesPanelRef"
              :project="project"
              :chapter-id="currentChapter.id"
              :chapter-title="currentChapter.title"
              :current-volume-id="currentVolume?.id"
              :current-arc-id="currentArc?.id"
              @locate="handleLocatePromise"
              @change="markUnsaved"
            />
          </div>

          <!-- Зафиксированный внизу блок планов тома / арки / главы -->
          <div class="parent-plans-container">
            <!-- План тома -->
            <div v-if="currentVolume" class="parent-plan-accordion">
              <div class="accordion-header" @click="isVolumePlanOpen = !isVolumePlanOpen">
                <span class="accordion-title"><i class="fas fa-book text-accent"></i> План тома: {{ currentVolume.title }}</span>
                <div class="flex items-center gap-2">
                  <button class="add-from-header-btn" title="Добавить пункт" @click.stop="addVolumePlanItem">+</button>
                  <span class="text-xs text-muted" :style="{ transform: isVolumePlanOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
                </div>
              </div>
              <div v-show="isVolumePlanOpen" class="accordion-body">
                <PlanningPanel
                  ref="volumePlanRef"
                  :project="project"
                  parent-type="volume"
                  :parent-id="currentVolume.id"
                  :parent-title="currentVolume.title"
                />
              </div>
            </div>

            <!-- План арки -->
            <div v-if="currentArc" class="parent-plan-accordion">
              <div class="accordion-header" @click="isArcPlanOpen = !isArcPlanOpen">
                <span class="accordion-title"><i class="fas fa-bookmark text-accent"></i> План арки: {{ currentArc.title }}</span>
                <div class="flex items-center gap-2">
                  <button class="add-from-header-btn" title="Добавить пункт" @click.stop="addArcPlanItem">+</button>
                  <span class="text-xs text-muted" :style="{ transform: isArcPlanOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
                </div>
              </div>
              <div v-show="isArcPlanOpen" class="accordion-body">
                <PlanningPanel
                  ref="arcPlanRef"
                  :project="project"
                  parent-type="arc"
                  :parent-id="currentArc.id"
                  :parent-title="currentArc.title"
                />
              </div>
            </div>

            <!-- План главы (сворачиваемый) -->
            <div v-if="currentChapterId" class="parent-plan-accordion">
              <div class="accordion-header" @click="isChapterPlanOpen = !isChapterPlanOpen">
                <span class="accordion-title"><i class="fas fa-file-alt text-accent"></i> План главы</span>
                <div class="flex items-center gap-2">
                  <button class="add-from-header-btn" title="Добавить пункт" @click.stop="addChapterPlanItem">+</button>
                  <span class="text-xs text-muted" :style="{ transform: isChapterPlanOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
                </div>
              </div>
              <div v-show="isChapterPlanOpen" class="accordion-body">
                <PlanningPanel
                  ref="chapterPlanRef"
                  :project="project"
                  parent-type="chapter"
                  :parent-id="currentChapterId"
                  :parent-title="currentChapter?.title"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Ничего не выбрано -->
        <div v-else class="flex-1 flex-col flex-center text-muted text-sm p-4 text-center gap-2">
          <i class="fas fa-hand-pointer text-2xl" style="opacity: 0.2;"></i>
          Выберите главу, арку или том
        </div>

      </div>
      
      <!-- HISTORY PANEL -->
      <aside v-if="showHistory" class="schema-catalog" style="width: 280px; box-shadow: -5px 0 20px rgba(0,0,0,0.2); z-index: 10;">
          <div class="flex justify-between items-center p-3 border-b text-xs font-bold">
              <span>История изменений</span>
              <button class="cursor-pointer text-muted" @click="showHistory = false">✕</button>
          </div>
          
          <div class="p-3 border-b">
            <label class="text-xs text-muted">Хранить последних версий:</label>
            <input v-model="maxSaves" type="number" class="input-base text-xs w-full mt-1">
          </div>
          
          <div v-if="isLoadingHistory" class="p-4 text-center text-muted text-xs">
              Загрузка истории...
          </div>
          <div v-else class="flex-1 overflow-y-auto p-3 flex-col gap-2">
              <div v-if="revisions.length === 0" class="text-xs text-muted text-center">Нет сохраненных версий</div>
              
              <div
                v-for="(rev, idx) in revisions" :key="rev.id" 
                class="catalog-item interactive-el"
                :style="{ background: previewingRevId === rev.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-input)' }"
                @click="previewHistory(rev)">
                  <div class="flex justify-between items-center w-full">
                      <span class="text-xs font-bold">{{ rev.formattedDate }}</span>
                      <button class="cursor-pointer text-accent text-sm" :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(rev)">
                        {{ rev.is_pinned ? '📍' : '📌' }}
                      </button>
                  </div>
                  <div class="text-xs text-muted mt-1" style="line-height: 1.4;">
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <span v-if="getDiffSummary(rev, revisions[idx + 1])" v-html="getDiffSummary(rev, revisions[idx + 1])"></span>
                      <span v-else>Базовая версия</span>
                  </div>
                  <div v-if="previewingRevId === rev.id" class="mt-1">
                      <span class="text-xs" style="color: #f5a623;">Режим предпросмотра</span>
                  </div>
              </div>
          </div>
      </aside>
    </div>
    
    <div v-else class="flex-1 flex-col flex-center text-muted">
      <div class="text-2xl mb-3" style="opacity: 0.2;">📖</div>
      <div class="text-base">Выберите главу для редактирования</div>
    </div>

    <!-- Floating UI Elements -->

    <div v-if="showQuickLinkHint" class="quick-link-info-panel fixed card-glass z-modal p-4" style="bottom: 80px; right: 20px; width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div class="flex justify-between mb-2">
        <strong class="text-accent"><i class="fas fa-bolt"></i> Быстрые ссылки Ctrl+Q</strong>
        <div>
          <button class="text-muted cursor-pointer text-xs mr-2" @click="dismissQuickLinkHintForever">Больше не показывать</button>
          <button class="text-muted cursor-pointer" @click="showQuickLinkHint = false">✕</button>
        </div>
      </div>
      <ol class="m-0 pl-4 text-sm text-main">
        <li>Напишите текст в квадратных скобках: <code>[Имя]</code></li>
        <li>Установите курсор после скобок</li>
        <li>Нажмите <kbd>Ctrl+Q</kbd></li>
      </ol>
    </div>

    <!-- Кнопка-кружок для показа подсказки -->
    <button v-if="!showQuickLinkHint && !hideQuickLinkHintForever" class="quick-link-hint-circle fixed cursor-pointer" title="Показать подсказку Ctrl+Q" style="bottom: 75px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: #667eea; color: white; font-size: 26px; font-weight: bold; border: none; box-shadow: 0 4px 16px rgba(102,126,234,0.18); display: flex; align-items: center; justify-content: center; z-index: 998;" @click="showQuickLinkHint = true">
      ?
    </button>

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
    <div v-if="debugError" class="fixed card-secondary z-tooltip p-3 font-mono text-xs" style="top: 20px; right: 20px; width: 300px; background: #ff6b6b; color: white;">
      <div class="flex justify-between mb-2">
        <strong>⚠️ Ошибка</strong>
        <button class="cursor-pointer" style="color: white;" @click="debugError = null">✕</button>
      </div>
      <div style="white-space: pre-wrap; word-break: break-all;">{{ debugError }}</div>
      <div class="mt-2 text-muted">Проект: {{ project }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EditorCore from '../EditorCoreTiptap/EditorCoreTiptap.vue';
import TimelinePanel from '../../timeline/Calendars/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanel from '../ParticipantsPanel/ParticipantsPanel.vue';
import PromisesPanel from '../PromisesPanel/PromisesPanel.vue';
import ExportModal from '../Export/ExportModal.vue';
import PlanningPanel from '../PlanningPanel/PlanningPanel.vue';
import FloatingEntityEditor from '../../entities/FloatingEntityEditor.vue';
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

const editorCoreRef = ref<{ scrollToParagraph: (idx: number, quote?: string) => void } | null>(null);
const promisesPanelRef = ref<{ addPromise: (p: { kind: string; quote: string; paragraph_index: number; block_id?: string | null }) => Promise<void>; loadPromises: () => Promise<void> } | null>(null);

const isTimelineOpen = ref(true);
const isParticipantsOpen = ref(true);

const handleCreatePromise = (payload: { kind: string; quote: string; paragraph_index: number; block_id?: string | null }) => {
  promisesPanelRef.value?.addPromise(payload);
};

const handleLocatePromise = (payload: { paragraphIndex: number; quote: string; blockId?: string }) => {
  editorCoreRef.value?.scrollToParagraph(payload.paragraphIndex, payload.quote);
};

const {
  chapters, currentChapterId, currentChapter,
  currentArc, currentVolume, isVolumePlanOpen,
  isArcPlanOpen, isChapterPlanOpen, volumePlanRef, arcPlanRef, chapterPlanRef,
  addVolumePlanItem, addArcPlanItem, addChapterPlanItem,
  hasUnsavedChanges, localActiveTreeNode, debugError,
  isExportModalOpen, showQuickLinkHint, isZenMode, floatingEditors, showHistory,
  isLoadingHistory, revisions, previewingRevId, maxSaves, toggleHistory,
  previewHistory, togglePin, getDiffSummary, changedFields,
  rightPanelWidth, isRightPanelVisible, triggerSave,
  closeFloatingEditor, startResize,
  hideQuickLinkHintForever, dismissQuickLinkHintForever,
  markUnsaved, handleOpenEntity,
  handleExport, handleScrollChange, handleAddParticipant
} = useChaptersMain({
  project: props.project,
  controlledChapterId: props.controlledChapterId || undefined,
  activeTreeNode: props.activeTreeNode || undefined
}, emit as (event: string, ...args: unknown[]) => void);
</script>

<style src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css" scoped></style>

<style scoped>
.panel-collapsible-wrapper {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.panel-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  background: rgba(255, 255, 255, 0.02);
  transition: background var(--anim-speed, 0.2s) ease;
}

.panel-header-bar:hover {
  background: var(--bg-hover);
}

.panel-header-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-bold, 600);
  color: var(--text-main);
}

.panel-header-arrow {
  font-size: var(--font-size-xs, 11px);
  color: var(--text-muted);
  transition: transform var(--anim-speed, 0.2s) ease;
}

.panel-body-box {
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
}

.panel-body-box::-webkit-scrollbar {
  width: 5px;
}

.panel-body-box::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body-box::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: var(--radius-round, 9999px);
}

.panel-body-box::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover, rgba(255, 255, 255, 0.2));
}
</style>
