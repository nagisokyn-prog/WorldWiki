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
        :existing-promises="promisesPanelRef?.promises || []"
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

      <!-- Right Panel -->
      <div v-if="isRightPanelVisible" class="chapter-right-panel flex-shrink-0" :style="{ '--panel-w': rightPanelWidth + 'px' }">

        <!-- Том или Арка выбрана: показываем только план -->
        <div v-if="localActiveTreeNode?.node && localActiveTreeNode?.type !== 'chapter'" class="flex-1 flex-col overflow-hidden">
          <PlanningPanel
            :project="project"
            :parent-type="localActiveTreeNode.type || 'volume'"
            :parent-id="localActiveTreeNode.node?.id || ''"
            :parent-title="localActiveTreeNode.node?.title || ''"
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
                <span class="panel-header-arrow" :class="{ 'is-open': isTimelineOpen }">▼</span>
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
                <span class="panel-header-arrow" :class="{ 'is-open': isParticipantsOpen }">▼</span>
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
              :all-chapters="chapters"
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
                  <span class="text-xs text-muted accordion-arrow" :class="{ 'is-open': isVolumePlanOpen }">▼</span>
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
                  <span class="text-xs text-muted accordion-arrow" :class="{ 'is-open': isArcPlanOpen }">▼</span>
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
                  <span class="text-xs text-muted accordion-arrow" :class="{ 'is-open': isChapterPlanOpen }">▼</span>
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
          <i class="fas fa-hand-pointer text-2xl icon-dim"></i>
          Выберите главу, арку или том
        </div>

      </div>
      
      <!-- HISTORY PANEL -->
      <aside v-if="showHistory" class="schema-catalog history-drawer">
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
                :class="{ 'is-previewing': previewingRevId === rev.id }"
                @click="previewHistory(rev)">
                  <div class="flex justify-between items-center w-full">
                      <span class="text-xs font-bold">{{ rev.formattedDate }}</span>
                      <button class="cursor-pointer text-accent text-sm" :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(rev)">
                        {{ rev.is_pinned ? '📍' : '📌' }}
                      </button>
                  </div>
                  <div class="text-xs text-muted mt-1 diff-summary-text">
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <span v-if="getDiffSummary(rev, revisions[idx + 1])" v-html="getDiffSummary(rev, revisions[idx + 1])"></span>
                      <span v-else>Базовая версия</span>
                  </div>
                  <div v-if="previewingRevId === rev.id" class="mt-1">
                      <span class="text-xs preview-badge-warning">Режим предпросмотра</span>
                  </div>
              </div>
          </div>
      </aside>
    </div>
    
    <div v-else class="flex-1 flex-col flex-center text-muted">
      <div class="text-2xl mb-3 icon-dim">📖</div>
      <div class="text-base">Выберите главу для редактирования</div>
    </div>

    <!-- Floating UI Elements -->

    <div v-if="showQuickLinkHint" class="quick-link-info-panel fixed card-glass z-modal p-4 quick-link-popup">
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
    <button v-if="!showQuickLinkHint && !hideQuickLinkHintForever" class="quick-link-hint-circle fixed cursor-pointer quick-link-trigger-btn" title="Показать подсказку Ctrl+Q" @click="showQuickLinkHint = true">
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
const promisesPanelRef = ref<InstanceType<typeof PromisesPanel> | null>(null);

const isTimelineOpen = ref(true);
const isParticipantsOpen = ref(true);

const {
  chapters, hierarchy, currentChapterId, currentChapter,
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
  handleExport, handleScrollChange, handleAddParticipant,
  openChapterFromTree
} = useChaptersMain({
  project: props.project,
  controlledChapterId: props.controlledChapterId || undefined,
  activeTreeNode: props.activeTreeNode || undefined
}, emit as (event: string, ...args: unknown[]) => void);

const handleCreatePromise = (payload: { kind: string; quote: string; paragraph_index: number; block_id?: string | null }) => {
  promisesPanelRef.value?.addPromise(payload);
};

const handleLinkMilestone = (payload: {
  promiseId: string;
  stage: 'progression' | 'resolution';
  quote: string;
  paragraph_index: number;
  block_id?: string | null;
}) => {
  promisesPanelRef.value?.addMilestone({
    ...payload,
    chapterId: currentChapter.value?.id || undefined
  });
};

const handleLocatePromise = (payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }) => {
  const cleanTarget = (payload.chapterId || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';
  const currentClean = (currentChapter.value?.id || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';

  // Если целевая глава отличается от текущей — открываем её таб
  if (currentClean && cleanTarget && cleanTarget !== currentClean) {
    const allList = chapters.value.length > 0 ? chapters.value : (hierarchy.value?.chapters || []);
    const targetChapter = allList.find((c: { id?: string | null }) => {
      const cClean = (c.id || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';
      return cClean === cleanTarget;
    });

    if (targetChapter) {
      const targetId = targetChapter.id 
        ? (String(targetChapter.id).startsWith('chapters:') ? String(targetChapter.id) : `chapters:${String(targetChapter.id)}`) 
        : `chapters:${cleanTarget}`;

      const chNode = {
        ...targetChapter,
        id: targetId,
        title: targetChapter.title || 'Глава'
      } as unknown as ChapterTreeNode;

      openChapterFromTree(chNode);
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('ww:locate-promise', {
          detail: payload
        }));
      }, 450);
      return;
    }
  }

  // Если уже открыта текущая глава
  editorCoreRef.value?.scrollToParagraph(payload.paragraphIndex, payload.quote);
};
</script>

<style src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css" scoped></style>

