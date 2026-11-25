<template>
  <div
    :data-event-id="normalizeId(ev.id)"
    class="event-node-card interactive-el"
    :class="{
      'event-node--active': isHighlighted(ev),
      'event-node--dimmed': isDimmed(ev),
      'event-node--ping': isPinged(ev),
      'event-node--flashback': ev.isFlashback,
    }"
    :title="`Кликните для перехода к сцене в тексте: ${ev.title}`"
    @mouseenter="onHoverEvent(ev.id)"
    @mouseleave="onHoverEvent(null)"
    @click="onNavigateScene(ev)"
  >
    <div class="event-header">
      <span class="event-kind-badge" :class="ev.kindMeta.badgeClass">{{ ev.kindMeta.icon }} {{ ev.kindMeta.label }}</span>
      <span v-if="ev.isFlashback" class="flashback-tag" title="Флешбэк">⏪</span>
      <span
        v-if="ev.crossDayChildCount"
        class="subscene-count-pill"
        :title="`Подсцен в других датах: ${ev.crossDayChildCount}`"
      >
        📎 {{ ev.crossDayChildCount }}
      </span>
      <button
        v-if="ev.primaryChapterId"
        type="button"
        class="event-chapter-pill"
        title="Показать главу на верхней оси"
        @click.stop="onScrollChapter(ev.primaryChapterId)"
      >
        📖 Гл.{{ ev.primaryChapterOrder ?? '' }}
      </button>
    </div>

    <button
      v-if="ev.parentIdNormalized && ev.parentTitle"
      type="button"
      class="event-parent-pill"
      :title="`Подсцена для: ${ev.parentTitle} (клик — перейти)`"
      @click.stop="onScrollEvent(ev.parentIdNormalized)"
    >
      ↳ {{ ev.parentTitle }}
    </button>

    <div class="event-node-title" :title="ev.title">{{ ev.title }}</div>

    <div v-if="ev.timeLabel || ev.location_id || ev.localTimeBadge" class="event-meta-row">
      <span v-if="ev.timeLabel" class="event-date-chip">🕒 {{ ev.timeLabel }}</span>
      <span v-if="ev.location_id" class="event-location-chip" :title="ev.locationName || ev.location_id">
        📍 {{ cleanLocationLabel(ev.location_id, ev.locationName) }}
      </span>
      <span v-if="ev.localTimeBadge" class="event-date-chip">{{ ev.localTimeBadge }}</span>
    </div>

    <div v-if="ev.cleanParticipants.length" class="event-participants-list">
      <span v-for="p in ev.cleanParticipants.slice(0, 2)" :key="p.id" class="participant-chip" :title="p.name">👤 {{ p.name }}</span>
      <span v-if="ev.cleanParticipants.length > 2" class="participant-more">+{{ ev.cleanParticipants.length - 2 }}</span>
    </div>

    <div v-if="ev.sameDayChildren?.length" class="same-day-subscenes" @click.stop>
      <div
        v-for="sub in ev.sameDayChildren"
        :key="'sub-ev-' + sub.id"
        :data-event-id="normalizeId(sub.id)"
        class="subscene-mini-card interactive-el"
        :class="{
          'event-node--active': isHighlighted(sub),
          'event-node--dimmed': isDimmed(sub),
          'event-node--ping': isPinged(sub),
          'event-node--flashback': sub.isFlashback,
        }"
        :title="`Подсцена — кликните для перехода к сцене в тексте: ${sub.title}`"
        @mouseenter="onHoverEvent(sub.id)"
        @mouseleave="onHoverEvent(null)"
        @click.stop="onNavigateScene(sub)"
      >
        <div class="subscene-mini-header">
          <span class="subscene-branch-icon">↳</span>
          <span class="event-kind-badge" :class="sub.kindMeta.badgeClass">{{ sub.kindMeta.icon }}</span>
          <span v-if="sub.isFlashback" class="flashback-tag" title="Флешбэк">⏪</span>
          <span v-if="sub.timeLabel" class="subscene-time">🕒 {{ sub.timeLabel }}</span>
          <button
            v-if="sub.primaryChapterId"
            type="button"
            class="event-chapter-pill"
            title="Показать главу на верхней оси"
            @click.stop="onScrollChapter(sub.primaryChapterId)"
          >
            📖 Гл.{{ sub.primaryChapterOrder ?? '' }}
          </button>
        </div>
        <div class="subscene-mini-title" :title="sub.title">{{ sub.title }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TimelineEventNodeProps, TimelineEventNodeEmits } from './TimelineEventNode.model';
import { useTimelineEventNode } from './useTimelineEventNode';

const props = defineProps<TimelineEventNodeProps>();
const emit = defineEmits<TimelineEventNodeEmits>();

const {
  normalizeId,
  cleanLocationLabel,
  isPinged,
  onHoverEvent,
  onNavigateScene,
  onScrollChapter,
  onScrollEvent,
} = useTimelineEventNode(props, emit);
</script>
