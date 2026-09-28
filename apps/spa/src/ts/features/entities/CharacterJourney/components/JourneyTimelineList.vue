<template>
  <div class="timeline-stream">
    <div
      v-for="item in timelineItems"
      :key="item.id"
      class="timeline-node"
      @click="$emit('select-scene', item)"
    >
      <!-- Marker Dot -->
      <div
        class="timeline-dot"
        :class="'dot-' + (item.badgeType || 'accent')"
      ></div>

      <!-- Card Content -->
      <div class="journey-scene-card">
        <div class="scene-card-header">
          <div class="scene-header-left">
            <span class="phase-badge" :class="'phase-' + (item.arc_phase || 'default')">
              {{ item.phaseLabel || '🌱 Сцена' }}
            </span>
            <span class="scene-title-text">{{ item.title }}</span>
          </div>

          <div class="scene-header-right">
            <span
              v-if="item.isFlashback"
              class="chip-flashback-alert"
              title="Хронология события опережает/отстает от порядка глав"
            >
              {{ item.flashbackDeltaLabel || '⏪ Флэшбек!' }}
            </span>
            <div v-if="item.boundArcs && item.boundArcs.length > 0" class="scene-bound-arcs-wrapper">
              <template v-for="(bArc, bIdx) in item.boundArcs" :key="bArc.arcId">
                <span v-if="bIdx > 0" class="arc-ampersand">&amp;</span>
                <span
                  class="badge-arc-chip"
                  :style="{ backgroundColor: bArc.arcColor || 'var(--accent)' }"
                >
                  {{ bArc.arcTitle }}
                </span>
              </template>
            </div>
            <span
              v-else-if="item.arc_title"
              class="badge-arc-chip"
              :style="{ backgroundColor: item.arc_color || 'var(--accent)' }"
            >
              {{ item.arc_title }}
            </span>
            <span
              v-if="item.badge"
              class="badge-status-chip"
              :class="'badge-' + (item.badgeType || 'accent')"
            >
              {{ item.badge }}
            </span>
          </div>
        </div>

        <!-- FULL SCENE TEXT (Без обрезки) -->
        <div v-if="item.fullText || item.description" class="journey-scene-fulltext">
          «{{ item.fullText || item.description }}»
        </div>

        <!-- Dual-Time Meta Row -->
        <div class="journey-meta-row">
          <span class="chip-reader-order">
            📖 Читатель: {{ item.chapter_title || ('Гл. ' + (item.chapter_order || '?')) }}
            <template v-if="item.paragraph_index !== undefined && item.paragraph_index !== null">
              · абз. {{ item.paragraph_index }}
            </template>
          </span>

          <span class="chip-chronology-time">
            ⏳ Хронология: {{ item.timeLabel || ('День ' + (item.chapter_order || 1)) }}
          </span>

          <span class="jump-to-editor-hint">
            📍 Перейти к абзацу
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { JourneyTimelineItem } from '../CharacterJourney.model';

defineProps<{
  timelineItems: JourneyTimelineItem[];
}>();

defineEmits<{
  (e: 'select-scene', item: JourneyTimelineItem): void;
}>();
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>

