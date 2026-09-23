<template>
  <div
    v-if="isVisible"
    class="chapter-right-panel flex-shrink-0"
    :style="{ '--panel-w': width + 'px' }"
  >
    <!-- Том или Арка выбрана: показываем только план -->
    <div v-if="activeTreeNode?.node && activeTreeNode?.type !== 'chapter'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PlanningPanel
        :project="project"
        :parent-type="activeTreeNode.type || 'volume'"
        :parent-id="activeTreeNode.node?.id || ''"
        :parent-title="activeTreeNode.node?.title || ''"
      />
    </div>

    <!-- Глава открыта: единый скролл всех блоков (таймлайн → участники → обещания → планы) -->
    <div v-else-if="currentChapter" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div class="chapter-panels-scroll flex-1 flex flex-col min-h-0 overflow-y-auto p-3 gap-3">
        <!-- Аккордеон: Таймлайн -->
        <div class="panel-collapsible-wrapper">
          <div class="panel-header-bar" @click="$emit('toggleTimeline')">
            <span class="panel-header-title">
              <i class="fas fa-calendar-alt text-accent mr-1"></i> Таймлайн главы
            </span>
            <span class="panel-header-arrow" :class="{ 'is-open': isTimelineOpen }">▼</span>
          </div>
          <div
            v-show="isTimelineOpen"
            class="panel-body-box"
            :style="{ height: timelineHeight + 'px' }"
          >
            <TimelinePanel
              :events="currentChapter.timeline_events || undefined"
              :project="project"
              @update:events="$emit('update:timeline-events', $event)"
              @change="$emit('markUnsaved')"
            />
          </div>
          <div
            v-show="isTimelineOpen"
            class="panel-resize-handle-vertical"
            :class="{ 'is-resizing': activeResizing === 'timeline' }"
            title="Потяните для изменения высоты"
            @mousedown="startVerticalResize($event, 'timeline')"
          ></div>
        </div>

        <!-- Аккордеон: Участники -->
        <div class="panel-collapsible-wrapper">
          <div class="panel-header-bar" @click="$emit('toggleParticipants')">
            <span class="panel-header-title">
              <i class="fas fa-users text-accent mr-1"></i> Участники
            </span>
            <span class="panel-header-arrow" :class="{ 'is-open': isParticipantsOpen }">▼</span>
          </div>
          <div
            v-show="isParticipantsOpen"
            class="panel-body-box"
            :style="{ height: participantsHeight + 'px' }"
          >
            <ParticipantsPanel
              :participants="currentChapter.participants || undefined"
              :project="project"
              @update:participants="$emit('update:participants', $event)"
              @change="$emit('markUnsaved')"
            />
          </div>
          <div
            v-show="isParticipantsOpen"
            class="panel-resize-handle-vertical"
            :class="{ 'is-resizing': activeResizing === 'participants' }"
            title="Потяните для изменения высоты"
            @mousedown="startVerticalResize($event, 'participants')"
          ></div>
        </div>

        <!-- Сюжетные обещания -->
        <PromisesPanel
          ref="promisesPanelRef"
          :project="project"
          :chapter-id="currentChapter.id"
          :chapter-title="currentChapter.title"
          :current-volume-id="currentVolume?.id"
          :all-chapters="chapters"
          @locate="$emit('locatePromise', $event)"
          @change="$emit('markUnsaved')"
        />

        <!-- Блок планов тома / главы -->
        <div class="parent-plans-container">
          <!-- План тома -->
          <div v-if="currentVolume" class="parent-plan-accordion">
            <div class="accordion-header" @click="$emit('toggleVolumePlan')">
              <span class="accordion-title"><i class="fas fa-book text-accent"></i> План тома: {{ currentVolume.title }}</span>
              <div class="flex items-center gap-2">
                <button class="add-from-header-btn" title="Добавить пункт" @click.stop="$emit('addVolumePlanItem')">+</button>
                <span class="text-xs text-muted accordion-arrow" :class="{ 'is-open': isVolumePlanOpen }">▼</span>
              </div>
            </div>
            <div
              v-show="isVolumePlanOpen"
              class="accordion-body"
              :style="{ height: volumePlanHeight + 'px' }"
            >
              <PlanningPanel
                ref="volumePlanRef"
                :project="project"
                parent-type="volume"
                :parent-id="currentVolume.id"
                :parent-title="currentVolume.title"
              />
            </div>
            <div
              v-show="isVolumePlanOpen"
              class="panel-resize-handle-vertical"
              :class="{ 'is-resizing': activeResizing === 'volumePlan' }"
              title="Потяните для изменения высоты"
              @mousedown="startVerticalResize($event, 'volumePlan')"
            ></div>
          </div>

          <!-- План главы (сворачиваемый) -->
          <div v-if="currentChapterId" class="parent-plan-accordion">
            <div class="accordion-header" @click="$emit('toggleChapterPlan')">
              <span class="accordion-title"><i class="fas fa-file-alt text-accent"></i> План главы</span>
              <div class="flex items-center gap-2">
                <button class="add-from-header-btn" title="Добавить пункт" @click.stop="$emit('addChapterPlanItem')">+</button>
                <span class="text-xs text-muted accordion-arrow" :class="{ 'is-open': isChapterPlanOpen }">▼</span>
              </div>
            </div>
            <div
              v-show="isChapterPlanOpen"
              class="accordion-body"
              :style="{ height: chapterPlanHeight + 'px' }"
            >
              <PlanningPanel
                ref="chapterPlanRef"
                :project="project"
                parent-type="chapter"
                :parent-id="currentChapterId"
                :parent-title="currentChapter?.title"
              />
            </div>
            <div
              v-show="isChapterPlanOpen"
              class="panel-resize-handle-vertical"
              :class="{ 'is-resizing': activeResizing === 'chapterPlan' }"
              title="Потяните для изменения высоты"
              @mousedown="startVerticalResize($event, 'chapterPlan')"
            ></div>
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
</template>

<script setup lang="ts">
import TimelinePanel from '../../../timeline/Calendars/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanel from '../../ParticipantsPanel/ParticipantsPanel.vue';
import PromisesPanel from '../../PromisesPanel/PromisesPanel.vue';
import PlanningPanel from '../../PlanningPanel/PlanningPanel.vue';
import type { ChapterRightSidebarProps, ChapterRightSidebarEmits } from './ChapterRightSidebar.model';
import { useChapterRightSidebar } from './useChapterRightSidebar';

defineProps<ChapterRightSidebarProps>();
defineEmits<ChapterRightSidebarEmits>();

const {
  promisesPanelRef,
  volumePlanRef,
  chapterPlanRef,
  timelineHeight,
  participantsHeight,
  volumePlanHeight,
  chapterPlanHeight,
  activeResizing,
  startVerticalResize
} = useChapterRightSidebar();

defineExpose({
  promisesPanelRef,
  volumePlanRef,
  chapterPlanRef
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>
