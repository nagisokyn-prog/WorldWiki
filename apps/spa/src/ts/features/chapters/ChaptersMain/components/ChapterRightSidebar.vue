<template>
  <div
    v-if="isVisible"
    class="chapter-right-panel flex-shrink-0"
    :style="{ '--panel-w': width + 'px' }"
  >
    <!-- Том или Арка выбрана: показываем только план -->
    <div v-if="activeTreeNode?.node && activeTreeNode?.type !== 'chapter'" class="flex-1 flex-col overflow-hidden">
      <PlanningPanel
        :project="project"
        :parent-type="activeTreeNode.type || 'volume'"
        :parent-id="activeTreeNode.node?.id || ''"
        :parent-title="activeTreeNode.node?.title || ''"
      />
    </div>

    <!-- Глава открыта: таймлайн → участники → обещания (скролл) + зафиксированные планы внизу -->
    <div v-else-if="currentChapter" class="flex-1 flex-col overflow-hidden">
      <div class="chapter-panels-scroll flex-1 overflow-y-auto p-3 flex-col gap-3">
        <!-- Аккордеон: Таймлайн -->
        <div class="panel-collapsible-wrapper">
          <div class="panel-header-bar" @click="$emit('toggleTimeline')">
            <span class="panel-header-title">
              <i class="fas fa-calendar-alt text-accent mr-1"></i> Таймлайн главы
            </span>
            <span class="panel-header-arrow" :class="{ 'is-open': isTimelineOpen }">▼</span>
          </div>
          <div v-show="isTimelineOpen" class="panel-body-box">
            <TimelinePanel
              :events="currentChapter.timeline_events"
              :project="project"
              @update:events="$emit('update:timeline-events', $event)"
              @change="$emit('markUnsaved')"
            />
          </div>
        </div>

        <!-- Аккордеон: Участники -->
        <div class="panel-collapsible-wrapper">
          <div class="panel-header-bar" @click="$emit('toggleParticipants')">
            <span class="panel-header-title">
              <i class="fas fa-users text-accent mr-1"></i> Участники
            </span>
            <span class="panel-header-arrow" :class="{ 'is-open': isParticipantsOpen }">▼</span>
          </div>
          <div v-show="isParticipantsOpen" class="panel-body-box">
            <ParticipantsPanel
              :participants="currentChapter.participants"
              :project="project"
              @update:participants="$emit('update:participants', $event)"
              @change="$emit('markUnsaved')"
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
          :all-chapters="chapters"
          @locate="$emit('locatePromise', $event)"
          @change="$emit('markUnsaved')"
        />
      </div>

      <!-- Зафиксированный внизу блок планов тома / главы -->
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

        <!-- План главы (сворачиваемый) -->
        <div v-if="currentChapterId" class="parent-plan-accordion">
          <div class="accordion-header" @click="$emit('toggleChapterPlan')">
            <span class="accordion-title"><i class="fas fa-file-alt text-accent"></i> План главы</span>
            <div class="flex items-center gap-2">
              <button class="add-from-header-btn" title="Добавить пункт" @click.stop="$emit('addChapterPlanItem')">+</button>
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
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TimelinePanel from '../../timeline/Calendars/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanel from '../ParticipantsPanel/ParticipantsPanel.vue';
import PromisesPanel from '../PromisesPanel/PromisesPanel.vue';
import PlanningPanel from '../PlanningPanel/PlanningPanel.vue';
import type { ActiveTreeNode } from '../useChaptersMain';
import type { ChapterWithHierarchy, HierarchyVolume } from '@/stores/chapter.store';

defineProps<{
  project: string;
  isVisible: boolean;
  width: number;
  activeTreeNode?: ActiveTreeNode | null;
  currentChapter?: ChapterWithHierarchy | null;
  currentVolume?: HierarchyVolume | null;
  currentChapterId?: string | null;
  chapters: ChapterWithHierarchy[];
  isTimelineOpen: boolean;
  isParticipantsOpen: boolean;
  isVolumePlanOpen: boolean;
  isChapterPlanOpen: boolean;
}>();

defineEmits<{
  (e: 'toggleTimeline'): void;
  (e: 'toggleParticipants'): void;
  (e: 'toggleVolumePlan'): void;
  (e: 'toggleChapterPlan'): void;
  (e: 'addVolumePlanItem'): void;
  (e: 'addChapterPlanItem'): void;
  (e: 'markUnsaved'): void;
  (e: 'update:timeline-events', val: ChapterWithHierarchy['timeline_events']): void;
  (e: 'update:participants', val: string[] | null): void;
  (e: 'locatePromise', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
}>();

const promisesPanelRef = ref<InstanceType<typeof PromisesPanel> | null>(null);
const volumePlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);
const chapterPlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);

defineExpose({
  promisesPanelRef,
  volumePlanRef,
  chapterPlanRef
});
</script>
