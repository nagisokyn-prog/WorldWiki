<template>
  <div class="chapters-view-container" :class="{ 'zen-mode-active': isZenMode }" style="display: flex; height: 100%; overflow: hidden; color: var(--text-main);">
    
    <!-- MAIN AREA -->
    <div v-if="currentChapter" style="flex: 1; display: flex; overflow: hidden;">
      
      <!-- Editor -->
      <EditorCore
        v-model:title="currentChapter.title"
        v-model:content="currentChapter.content"
        v-model:footnotes-data="currentChapter.footnotes"
        :project="project"
        :has-unsaved-changes="hasUnsavedChanges"
        :initial-scroll-pos="currentChapter.scrollPos || 0"
        :changed-fields="changedFields"
        @change="markUnsaved"
        @save="saveChapter"
        @open-entity="handleOpenEntity"
        @scroll-change="handleScrollChange"
        @toggle-history="toggleHistory"
      />

      <!-- Right Panel Resizer -->
      <div v-if="isRightPanelVisible" class="panel-resize-handle" style="width: 4px; cursor: col-resize; background: transparent; transition: background 0.2s;" @mousedown="startResize"></div>

      <!-- Right Panel -->
      <div v-if="isRightPanelVisible" class="chapter-right-panel" :style="{ width: rightPanelWidth + 'px' }" style="background: rgba(0,0,0,0.15); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;">

        <!-- Том или Арка выбрана: показываем только план -->
        <div v-if="localActiveTreeNode && localActiveTreeNode.type !== 'chapter'" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
          <PlanningPanel
            :project="project"
            :parent-type="localActiveTreeNode.type"
            :parent-id="localActiveTreeNode.node.id"
            :parent-title="localActiveTreeNode.node.title"
          />
        </div>

        <!-- Глава открыта: таймлайн → участники → план -->
        <div v-else-if="currentChapter" style="padding: 20px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0;">
          <TimelinePanel
            v-model:events="currentChapter.timeline_events"
            :project="project"
            @change="markUnsaved"
          />
          <ParticipantsPanel
            v-model:participants="currentChapter.participants"
            :project="project"
            @change="markUnsaved"
          />
          <div class="parent-plans-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
            <!-- План тома -->
            <div v-if="currentVolume" class="parent-plan-accordion" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin: 0 14px;">
              <div class="accordion-header" style="cursor: pointer; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); transition: background 0.2s;" @click="isVolumePlanOpen = !isVolumePlanOpen">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="fas fa-book" style="color: var(--accent);"></i> План тома: {{ currentVolume.title }}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button style="background: none; border: none; color: var(--accent); cursor: pointer; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 14px; transition: background 0.2s;" class="add-from-header-btn" @click.stop="addVolumePlanItem">+</button>
                  <span style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;" :style="{ transform: isVolumePlanOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
                </div>
              </div>
              <div v-show="isVolumePlanOpen" class="accordion-body" style="border-top: 1px solid var(--border-color); height: 200px; min-height: 100px; max-height: 600px; resize: vertical; overflow-y: auto; display: flex; flex-direction: column;">
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
            <div v-if="currentArc" class="parent-plan-accordion" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin: 0 14px;">
              <div class="accordion-header" style="cursor: pointer; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); transition: background 0.2s;" @click="isArcPlanOpen = !isArcPlanOpen">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="fas fa-bookmark" style="color: var(--accent);"></i> План арки: {{ currentArc.title }}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button style="background: none; border: none; color: var(--accent); cursor: pointer; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 14px; transition: background 0.2s;" class="add-from-header-btn" @click.stop="addArcPlanItem">+</button>
                  <span style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;" :style="{ transform: isArcPlanOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
                </div>
              </div>
              <div v-show="isArcPlanOpen" class="accordion-body" style="border-top: 1px solid var(--border-color); height: 200px; min-height: 100px; max-height: 600px; resize: vertical; overflow-y: auto; display: flex; flex-direction: column;">
                <PlanningPanel
                  ref="arcPlanRef"
                  :project="project"
                  parent-type="arc"
                  :parent-id="currentArc.id"
                  :parent-title="currentArc.title"
                />
              </div>
            </div>

            <!-- План главы -->
            <div v-if="currentChapterId" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin: 0 14px 14px 14px; height: 300px; min-height: 150px; max-height: 800px; resize: vertical; display: flex; flex-direction: column;">
              <div class="accordion-header" style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-color);">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="fas fa-file-alt" style="color: var(--accent);"></i> План главы</span>
              </div>
              <PlanningPanel
                :project="project"
                parent-type="chapter"
                :parent-id="currentChapterId"
                :parent-title="currentChapter?.title"
              />
            </div>
          </div>
        </div>

        <!-- Ничего не выбрано -->
        <div v-else style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); font-size:13px; padding:20px; text-align:center; gap:10px;">
          <i class="fas fa-hand-pointer" style="font-size:28px; opacity:0.2;"></i>
          Выберите главу, арку или том
        </div>

      </div>
      
      <!-- HISTORY PANEL -->
      <aside v-if="showHistory" style="width: 280px; background: var(--bg-panel); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0; box-shadow: -5px 0 20px rgba(0,0,0,0.2); z-index: 10;">
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 12px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
              <span>История изменений</span>
              <button style="background: none; border: none; cursor: pointer; color: var(--text-muted);" @click="showHistory = false">✕</button>
          </div>
          
          <div style="padding: 12px; border-bottom: 1px solid var(--border-color);">
            <label style="font-size: 10px; color: var(--text-muted);">Хранить последних версий:</label>
            <input v-model="maxSaves" type="number" class="input-base" style="width: 100%; font-size: 12px; padding: 4px; margin-top: 4px;">
          </div>
          
          <div v-if="isLoadingHistory" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">
              Загрузка истории...
          </div>
          <div v-else style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div v-if="revisions.length === 0" style="font-size: 10px; color: var(--text-muted); text-align: center;">Нет сохраненных версий</div>
              
              <div
v-for="(rev, idx) in revisions" :key="rev.id" 
                   :style="{ background: previewingRevId === rev.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-input)' }"
                   style="padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s, background-color 0.2s, opacity 0.2s;"
                   @click="previewHistory(rev)">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 11px; font-weight: bold;">{{ rev.formattedDate }}</span>
                      <button style="background: none; border: none; cursor: pointer; font-size: 12px; color: var(--accent);" :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(rev)">
                        {{ rev.is_pinned ? '📍' : '📌' }}
                      </button>
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <span v-if="getDiffSummary(rev, revisions[idx + 1])" v-html="getDiffSummary(rev, revisions[idx + 1])"></span>
                      <span v-else>Базовая версия</span>
                  </div>
                  <div v-if="previewingRevId === rev.id" style="margin-top: 8px;">
                      <span style="font-size: 9px; color: #f5a623;">Режим предпросмотра</span>
                  </div>
              </div>
          </div>
      </aside>
    </div>
    
    <div v-else class="empty-state" style="flex: 1; display: flex; justify-content: center; align-items: center; color: var(--text-muted); flex-direction: column;">
      <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.2;">📖</div>
      <div style="font-size: 16px;">Выберите главу для редактирования</div>
    </div>

    <!-- Floating UI Elements -->

    <div v-if="showQuickLinkHint" class="quick-link-info-panel" style="position: fixed; bottom: 80px; right: 20px; width: 320px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; z-index: 999; padding: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <strong style="color: var(--accent);"><i class="fas fa-bolt"></i> Быстрые ссылки Ctrl+Q</strong>
        <div>
          <button style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 11px; margin-right: 8px;" @click="dismissQuickLinkHintForever">Больше не показывать</button>
          <button style="background:none; border:none; color:var(--text-muted); cursor:pointer;" @click="showQuickLinkHint = false">✕</button>
        </div>
      </div>
      <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-main);">
        <li>Напишите текст в квадратных скобках: <code>[Имя]</code></li>
        <li>Установите курсор после скобок</li>
        <li>Нажмите <kbd>Ctrl+Q</kbd></li>
      </ol>
    </div>

    <!-- Кнопка-кружок для показа подсказки -->
    <button v-if="!showQuickLinkHint && !hideQuickLinkHintForever" class="quick-link-hint-circle" title="Показать подсказку Ctrl+Q" style="position: fixed; bottom: 75px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: #667eea; color: white; font-size: 26px; font-weight: bold; border: none; box-shadow: 0 4px 16px rgba(102,126,234,0.18); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 998; transition: transform 0.2s, background-color 0.2s, opacity 0.2s;" @click="showQuickLinkHint = true">
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
    <div v-if="debugError" style="position: fixed; top: 20px; right: 20px; width: 300px; background: #ff6b6b; color: white; padding: 16px; border-radius: 8px; z-index: 9999; font-family: monospace; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <strong>⚠️ Ошибка</strong>
        <button style="background: none; border: none; color: white; cursor: pointer;" @click="debugError = null">✕</button>
      </div>
      <div style="white-space: pre-wrap; word-break: break-all;">{{ debugError }}</div>
      <div style="margin-top: 8px; opacity: 0.8;">Проект: {{ project }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue';
import EditorCore from '../EditorCoreTiptap/EditorCoreTiptap.vue';
import TimelinePanel from '../../timeline/Calendars/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanel from '../ParticipantsPanel/ParticipantsPanel.vue';
import ExportModal from '../Export/ExportModal.vue';
import PlanningPanel from '../PlanningPanel/PlanningPanel.vue';
import FloatingEntityEditor from '../../entities/FloatingEntityEditor.vue';
import { useChaptersMain } from './useChaptersMain';

const props = withDefaults(defineProps<{
  project: string;
  controlledChapterId?: string | null;
  activeTreeNode?: { type: string; node: any } | null;
}>(), {
  controlledChapterId: null,
  activeTreeNode: null
});

const emit = defineEmits<{
  'open-chapter-as-tab': [chapter: any];
  'chapter-unsaved': [];
  'chapter-saved': [];
  'chapter-renamed': [payload: { id: string; title: string }];
  'scroll-change': [scroll: number];
}>();

const {
  chapters, currentChapterId, currentChapter,
  currentArc, currentVolume, isVolumePlanOpen,
  isArcPlanOpen, volumePlanRef, arcPlanRef, addVolumePlanItem, addArcPlanItem,
  hasUnsavedChanges, localActiveTreeNode, debugError,
  isExportModalOpen, showQuickLinkHint, isZenMode, floatingEditors, showHistory,
  isLoadingHistory, revisions, previewingRevId, maxSaves, toggleHistory,
  previewHistory, togglePin, getDiffSummary, changedFields,
  rightPanelWidth, isRightPanelVisible, saveChapter,
  hideQuickLinkHintForever, dismissQuickLinkHintForever,
  markUnsaved, handleOpenEntity, closeFloatingEditor,
  handleExport, handleScrollChange, startResize
} = useChaptersMain(props, emit);
</script>

<style src="./ChaptersMain.vue.css" scoped></style>
