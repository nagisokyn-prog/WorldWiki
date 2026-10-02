<template>
  <div class="journey-tree-container">
    <!-- Root Characters Node -->
    <div v-if="selectedEntities && selectedEntities.length > 0" class="journey-tree-root-card">
      <div class="root-card-left">
        <span class="root-entity-avatar">👥</span>
        <span class="root-entity-name">
          {{ selectedEntities.map((e) => e.name).join(' & ') }}
        </span>
        <span class="root-entity-type-badge">
          {{ selectedEntities.length > 1 ? `${selectedEntities.length} персонажей` : (selectedEntities[0].entity_type || 'Персонаж') }}
        </span>
      </div>
      <div class="root-card-right">
        <span class="root-tree-stats">
          {{ totalScenesCount }} сцен · {{ arcGroups.length }} ветвей
        </span>
      </div>
    </div>
    <div v-else-if="currentEntity" class="journey-tree-root-card">
      <div class="root-card-left">
        <span class="root-entity-avatar">👤</span>
        <span class="root-entity-name">{{ currentEntity.name }}</span>
        <span class="root-entity-type-badge">{{ currentEntity.entity_type }}</span>
      </div>
      <div class="root-card-right">
        <span class="root-tree-stats">
          {{ totalScenesCount }} сцен · {{ arcGroups.length }} ветвей
        </span>
      </div>
    </div>

    <!-- Tree Branches (Arcs) -->
    <div
      v-for="(group, gIdx) in arcGroups"
      :key="group.arcId"
      class="journey-arc-group"
      :class="{
        'is-last-arc': gIdx === arcGroups.length - 1,
        'is-collapsed': isArcCollapsed(group.arcId),
      }"
    >
      <!-- Arc Branch Header (Folder / Collapsible) -->
      <div
        class="journey-arc-header"
        role="button"
        tabindex="0"
        :aria-expanded="!isArcCollapsed(group.arcId)"
        @click="toggleArc(group.arcId)"
        @keydown.enter.prevent="toggleArc(group.arcId)"
        @keydown.space.prevent="toggleArc(group.arcId)"
      >
        <div class="arc-header-left">
          <span class="tree-branch-marker">{{ gIdx === arcGroups.length - 1 ? '└──' : '├──' }}</span>
          <span class="arc-toggle-chevron">{{ isArcCollapsed(group.arcId) ? '▶' : '▼' }}</span>
          <span
            class="arc-color-pill"
            :style="{ backgroundColor: group.arcColor || 'var(--accent)' }"
          ></span>
          <span class="arc-folder-icon">{{ isArcCollapsed(group.arcId) ? '📁' : '📂' }}</span>
          <span class="arc-header-title">{{ group.arcTitle }}</span>
        </div>
        <span class="arc-header-count">
          {{ group.items.length }} сцен
        </span>
      </div>

      <!-- Tree Branch with Scene Nodes -->
      <div v-show="!isArcCollapsed(group.arcId)" class="journey-arc-branch">
        <template
          v-for="(item, sIdx) in group.items"
          :key="item.id"
        >
          <!-- Meeting Gap Divider in Branch -->
          <JourneyMeetingGapDivider
            v-if="item.meetingGap"
            :gap="item.meetingGap"
          />

          <div
            class="journey-scene-card"
            :class="{ 'is-last-scene': sIdx === group.items.length - 1 }"
            @click="$emit('select-scene', item)"
          >
            <!-- Scene Node Header -->
            <div class="scene-card-header">
              <div class="scene-header-left">
                <span class="tree-leaf-marker">{{ sIdx === group.items.length - 1 ? '└──' : '├──' }}</span>
                <div v-if="item.boundArcs && item.boundArcs.length > 0" class="scene-bound-arcs-wrapper">
                  <template v-for="(bArc, bIdx) in item.boundArcs" :key="bArc.arcId">
                    <span v-if="bIdx > 0" class="arc-ampersand">&amp;</span>
                    <span class="phase-badge" :class="'phase-' + (bArc.phase || 'default')">
                      {{ bArc.phaseLabel }}
                    </span>
                    <span
                      v-if="item.boundArcs.length > 1"
                      class="badge-arc-chip-mini"
                      :style="{ backgroundColor: bArc.arcColor || 'var(--accent)' }"
                    >
                      {{ bArc.arcTitle }}
                    </span>
                  </template>
                </div>
                <span v-else class="phase-badge" :class="'phase-' + (item.arc_phase || 'default')">
                  {{ item.phaseLabel || '🌱 Сцена' }}
                </span>
                <span class="scene-title-text">{{ item.title }}</span>
              </div>

              <div class="scene-header-right">
                <span
                  v-if="item.isFlashback"
                  class="chip-flashback-alert"
                  title="Хронология события идет вспять относительно порядка глав"
                >
                  {{ item.flashbackDeltaLabel || '⏪ Флэшбек!' }}
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

            <!-- FULL SCENE TEXT (Без обрезки) -->
            <div v-else-if="item.fullText || item.description" class="journey-scene-fulltext">
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
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Entity } from '@/types/generated/Entity';
import type { ArcGroup, JourneyTimelineItem } from '../CharacterJourney.model';
import JourneyMeetingGapDivider from './JourneyMeetingGapDivider.vue';
import { useJourneyArcGroups } from './useJourneyArcGroups';

const props = defineProps<{
  arcGroups: ArcGroup[];
  currentEntity?: Entity | null;
  selectedEntities?: Entity[];
}>();

defineEmits<{
  (e: 'select-scene', item: JourneyTimelineItem): void;
}>();

const { isArcCollapsed, toggleArc, totalScenesCount } = useJourneyArcGroups(() => props.arcGroups);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>



