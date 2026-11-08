<template>
  <div
    :data-chapter-id="normalizeId(chapter.id)"
    class="chapter-node interactive-el"
    :class="{
      'chapter-node--active': isActive,
      'chapter-node--has-flashback': (chapter.flashbackCount || 0) > 0,
    }"
    :style="{ position: 'absolute', top: '24px', left: (60 + index * 140) + 'px' }"
    @click="onClick"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="chapter-pin-top"></div>

    <div class="chapter-node-header">
      <span class="chapter-badge">Гл. #{{ chapter.sort_order }}</span>
      <span
        v-if="chapter.sceneCount !== undefined"
        class="chapter-scene-count"
        :title="`Сцен в главе: ${chapter.sceneCount}`"
      >
        🎬 {{ chapter.sceneCount }}
      </span>
    </div>

    <div class="chapter-node-title" :title="chapter.title">
      {{ chapter.title }}
    </div>

    <!-- Бейдж-радар прыжка к флешбэку -->
    <div
      v-if="(chapter.flashbackCount || 0) > 0"
      class="chapter-flashback-badge"
      :title="`В этой главе ${chapter.flashbackCount} флешбэк(а). Кликните, чтобы прыгнуть к сцене в прошлом`"
      @click.stop="onJumpFlashback($event)"
    >
      ⏪ Флешбэк ({{ chapter.flashbackCount }})
    </div>

    <div class="chapter-node-actions">
      <button
        class="chapter-action-btn"
        title="Открыть главу в редакторе"
        @click.stop="onNavigate"
      >
        ✏️
      </button>
    </div>

    <div class="chapter-pin-bottom"></div>
  </div>
</template>

<script setup lang="ts">
import type { TimelineChapterNodeProps, TimelineChapterNodeEmits } from './TimelineChapterNode.model';
import { useTimelineChapterNode } from './useTimelineChapterNode';

const props = defineProps<TimelineChapterNodeProps>();
const emit = defineEmits<TimelineChapterNodeEmits>();

const {
  normalizeId,
  onClick,
  onNavigate,
  onJumpFlashback,
  onMouseEnter,
  onMouseLeave,
} = useTimelineChapterNode(props, emit);
</script>

