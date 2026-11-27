<template>
  <div class="promise-timeline">
    <!-- 1. 🌱 ТОЧКА ПОСАДКИ (PLANT) / 🎬 СЦЕНА -->
    <div class="timeline-step step-plant">
      <div class="step-badge">
        <span class="step-icon">{{ item.kind === 'scene' ? '🎬' : '🌱' }}</span>
        <span class="step-name">{{ item.kind === 'scene' ? 'Сцена:' : 'Посажено:' }}</span>
        <span class="step-location">{{ getChapterTitle(item.chapter_id || '') }} · абз. {{ item.paragraph_index ?? 1 }}</span>
        <span v-if="isCurrentChapterPromise(item.chapter_id || '')" class="badge-current-chapter">текущая</span>
      </div>

      <!-- ⚠️ Orphan-баннер: исходный текст удалён из рукописи -->
      <div v-if="item.is_orphaned" class="orphan-banner">
        <span class="orphan-icon">⚠️</span>
        <span class="orphan-text">Текст удалён из рукописи</span>
        <button class="orphan-delete-btn" title="Удалить карточку" @click.stop="$emit('remove')">Удалить</button>
      </div>

      <blockquote class="card-quote" :class="{ 'quote-orphaned': item.is_orphaned }">
        «{{ item.quote || item.title }}»
      </blockquote>

      <div class="step-actions">
        <button class="btn-locate-step" @click="$emit('locate')">
          {{ item.kind === 'scene' ? '📍 Перейти к сцене' : '📍 Перейти к фразе' }}
        </button>
      </div>
    </div>

    <!-- 2. 🌿 ТОЧКИ РАЗВИТИЯ (PROGRESSIONS) - ТОЛЬКО ДЛЯ РУЖЕЙ -->
    <div v-if="item.kind !== 'scene' && item.progressions && item.progressions.length > 0" class="timeline-group-progressions">
      <div class="group-header">
        <span class="step-icon">🌿</span>
        <span class="group-title">Развитие ({{ item.progressions.length }}):</span>
      </div>

      <PromiseMilestoneCard
        v-for="(prog, pIdx) in item.progressions"
        :key="prog.milestone_id || prog.id || prog.quote || pIdx"
        :project="project"
        :parent-item="item"
        :milestone="prog"
        stage="progression"
        :get-chapter-title="getChapterTitle"
        :is-current-chapter-promise="isCurrentChapterPromise"
        :previous-scene="getProgressionPrevious(pIdx)"
        :shared-entities="sharedEntities"
        @locate-step="$emit('locateStep', $event)"
        @remove-milestone="$emit('removeMilestone', $event)"
        @update:item="$emit('update:item', $event)"
        @change="$emit('change')"
      />
    </div>

    <!-- 3. 🎯 ТОЧКА ВЫСТРЕЛА / РАЗВЯЗКИ (RESOLUTION) - ТОЛЬКО ДЛЯ РУЖЕЙ -->
    <div v-if="item.kind !== 'scene' && item.resolution" class="timeline-step step-resolution">
      <PromiseMilestoneCard
        :project="project"
        :parent-item="item"
        :milestone="item.resolution"
        stage="resolution"
        :get-chapter-title="getChapterTitle"
        :is-current-chapter-promise="isCurrentChapterPromise"
        :previous-scene="resolutionPrevious"
        :shared-entities="sharedEntities"
        @locate-step="$emit('locateStep', $event)"
        @remove-milestone="$emit('removeMilestone', $event)"
        @update:item="$emit('update:item', $event)"
        @change="$emit('change')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromiseCardTimelineProps, PromiseCardTimelineEmits } from '../PromiseCard.model';
import PromiseMilestoneCard from './PromiseMilestoneCard/PromiseMilestoneCard.vue';
import { usePromiseCardTimeline } from './usePromiseCardTimeline';

const props = defineProps<PromiseCardTimelineProps>();
defineEmits<PromiseCardTimelineEmits>();

const { getProgressionPrevious, resolutionPrevious } = usePromiseCardTimeline(props);
</script>

