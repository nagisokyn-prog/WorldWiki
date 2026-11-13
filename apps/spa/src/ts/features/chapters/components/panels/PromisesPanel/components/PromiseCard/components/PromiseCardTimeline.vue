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

      <div
        v-for="(prog, pIdx) in item.progressions"
        :key="prog.id || prog.milestone_id || prog.quote || pIdx"
        class="timeline-step step-progression"
      >
        <div class="step-badge">
          <span class="step-connector">├─</span>
          <span class="step-location font-medium">{{ getChapterTitle(prog.chapter_id || '') }} · абз. {{ prog.paragraph_index ?? 1 }}</span>
          <span v-if="isCurrentChapterPromise(prog.chapter_id || '')" class="badge-current-chapter">текущая</span>
          <button
            class="btn-delete-step"
            title="Удалить это упоминание"
            @click="$emit('removeMilestone', { item, milestoneId: prog.id || prog.milestone_id || '', stage: 'progression' })"
          >
            ✕
          </button>
        </div>

        <blockquote class="card-quote quote-small">
          «{{ prog.quote || '' }}»
        </blockquote>

        <div class="step-actions">
          <button class="btn-locate-step" @click="$emit('locateStep', { chapter_id: prog.chapter_id || '', paragraph_index: prog.paragraph_index ?? 1, quote: prog.quote || '' })">
            📍 Перейти
          </button>
        </div>
      </div>
    </div>

    <!-- 3. 🎯 ТОЧКА ВЫСТРЕЛА / РАЗВЯЗКИ (RESOLUTION) - ТОЛЬКО ДЛЯ РУЖЕЙ -->
    <div v-if="item.kind !== 'scene' && item.resolution" class="timeline-step step-resolution">
      <div class="step-badge">
        <span class="step-icon">🎯</span>
        <span class="step-name font-bold text-success">Отстреляно:</span>
        <span class="step-location font-semibold">{{ getChapterTitle(item.resolution.chapter_id || '') }} · абз. {{ item.resolution.paragraph_index ?? 1 }}</span>
        <span v-if="isCurrentChapterPromise(item.resolution.chapter_id || '')" class="badge-current-chapter">текущая</span>
        <button
          class="btn-delete-step"
          title="Сбросить завершение"
          @click="$emit('removeMilestone', { item, milestoneId: item.resolution?.id || item.resolution?.milestone_id || '', stage: 'resolution' })"
        >
          ✕
        </button>
      </div>

      <blockquote class="card-quote quote-resolution">
        «{{ item.resolution.quote || '' }}»
      </blockquote>

      <div class="step-actions">
        <button class="btn-locate-step" @click="$emit('locateStep', { chapter_id: item.resolution?.chapter_id || '', paragraph_index: item.resolution?.paragraph_index ?? 1, quote: item.resolution?.quote || '' })">
          📍 Перейти к финалу
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromiseCardTimelineProps, PromiseCardTimelineEmits } from '../PromiseCard.model';

defineProps<PromiseCardTimelineProps>();
defineEmits<PromiseCardTimelineEmits>();
</script>

