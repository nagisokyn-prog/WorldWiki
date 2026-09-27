<template>
  <div class="timeline-stream relative pl-6 border-l-2 border-subtle ml-4 space-y-6">
    <div
      v-for="item in timelineItems"
      :key="item.id"
      class="timeline-node relative group cursor-pointer"
      @click="$emit('select-scene', item)"
    >
      <!-- Marker Dot -->
      <div
        class="timeline-dot absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-surface flex items-center justify-center"
        :class="'dot-' + (item.badgeType || 'accent')"
      ></div>

      <!-- Card Content -->
      <div class="journey-card p-4 rounded border border-subtle bg-surface hover:bg-surface-hover transition-colors shadow-sm">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="font-bold text-sm text-main">{{ item.title }}</span>
          <div class="flex items-center gap-1.5">
            <span
              v-if="item.isFlashback"
              class="flashback-indicator"
              title="Хронология события опережает/отстает от порядка глав"
            >
              ⏪ Флэшбек
            </span>
            <span
              v-if="item.arc_title"
              class="badge text-2xs px-2 py-0.5 rounded font-medium"
              :style="{ backgroundColor: item.arc_color || 'var(--color-accent)', color: 'var(--color-surface)' }"
            >
              {{ item.arc_title }}
            </span>
            <span
              v-if="item.badge"
              class="badge text-2xs px-2 py-0.5 rounded font-medium"
              :class="'badge-' + (item.badgeType || 'accent')"
            >
              {{ item.badge }}
            </span>
          </div>
        </div>

        <div v-if="item.subtitle" class="text-xs text-muted mb-1">
          {{ item.subtitle }}
        </div>

        <div v-if="item.description" class="text-xs text-main opacity-90 mt-2 p-2 rounded bg-input border border-subtle">
          {{ item.description }}
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
