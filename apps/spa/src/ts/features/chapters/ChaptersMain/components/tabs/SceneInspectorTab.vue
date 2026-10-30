<template>
  <div class="chapter-panels-scroll flex-1 flex flex-col min-h-0 overflow-y-auto p-3 gap-3">
    <!-- Аккордеон: Таймлайн -->
    <div class="panel-collapsible-wrapper">
      <div class="panel-header-bar" @click="$emit('toggle-timeline')">
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
          :events="currentChapter?.timeline_events || undefined"
          :project="project"
          @update:events="$emit('update:timeline-events', $event)"
          @change="$emit('mark-unsaved')"
        />
      </div>
      <div
        v-show="isTimelineOpen"
        class="panel-resize-handle-vertical"
        :class="{ 'is-resizing': activeResizing === 'timeline' }"
        title="Потяните для изменения высоты"
        @mousedown="$emit('start-resize', $event, 'timeline')"
      ></div>
    </div>

    <!-- Аккордеон: Участники -->
    <div class="panel-collapsible-wrapper">
      <div class="panel-header-bar" @click="$emit('toggle-participants')">
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
          :participants="currentChapter?.participants || undefined"
          :project="project"
          @update:participants="$emit('update:participants', $event)"
          @change="$emit('mark-unsaved')"
        />
      </div>
      <div
        v-show="isParticipantsOpen"
        class="panel-resize-handle-vertical"
        :class="{ 'is-resizing': activeResizing === 'participants' }"
        title="Потяните для изменения высоты"
        @mousedown="$emit('start-resize', $event, 'participants')"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SceneInspectorTabProps, SceneInspectorTabEmits } from './SceneInspectorTab.model';
import TimelinePanel from '../../../../timeline/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanel from '../../../ParticipantsPanel/ParticipantsPanel.vue';

defineProps<SceneInspectorTabProps>();

defineEmits<SceneInspectorTabEmits>();
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>
