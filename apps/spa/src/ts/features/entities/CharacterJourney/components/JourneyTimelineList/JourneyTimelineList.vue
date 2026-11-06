<template>
  <div class="timeline-stream">
    <template v-for="item in timelineItems" :key="item.id">
      <!-- Meeting Gap Divider (if there is a gap between chapters) -->
      <JourneyMeetingGapDivider
        v-if="item.meetingGap"
        :gap="item.meetingGap"
      />

      <div
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

          <!-- Present Participants Details in Multi-Entity Mode -->
          <div v-if="item.participants && item.participants.length > 0" class="scene-participants-container">
            <div
              v-for="part in item.participants"
              :key="part.entity_id"
              class="participant-item"
            >
              <div class="participant-main-info">
                <span class="participant-avatar-icon">👤</span>
                <span class="participant-name-text">{{ part.entity_name }}</span>
                <span v-if="part.role_in_story" class="participant-role-tag">
                  ({{ part.role_in_story }})
                </span>
              </div>

              <div class="participant-meta-tags">
                <span
                  v-if="part.age_label"
                  class="chip-character-age"
                  :class="{ 'chip-before-birth': part.is_before_birth }"
                >
                  🎂 {{ part.age_label }}
                </span>
                <template v-if="part.arcs && part.arcs.length > 0">
                  <span
                    v-for="pArc in part.arcs"
                    :key="pArc.arc_id"
                    class="badge-arc-chip-mini"
                    :style="{ backgroundColor: pArc.color || 'var(--accent)' }"
                  >
                    {{ pArc.arc_title }}
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- FULL SCENE TEXT / QUOTE (Без обрезки) -->
          <div v-if="item.fullText || item.description || item.subtitle" class="journey-scene-fulltext">
            «{{ item.fullText || item.description || item.subtitle }}»
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

            <span
              v-if="item.ageLabel"
              class="chip-character-age"
              :class="{ 'chip-before-birth': item.isBeforeBirth }"
              :title="item.isBeforeBirth ? 'Событие происходит до рождения персонажа' : 'Возраст персонажа в момент события'"
            >
              🎂 {{ item.ageLabel }}
            </span>

            <span class="jump-to-editor-hint">
              📍 Перейти к абзацу
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { JourneyTimelineListProps, JourneyTimelineListEmits } from './JourneyTimelineList.model';
import JourneyMeetingGapDivider from '../JourneyMeetingGapDivider/JourneyMeetingGapDivider.vue';

defineProps<JourneyTimelineListProps>();

defineEmits<JourneyTimelineListEmits>();
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>


