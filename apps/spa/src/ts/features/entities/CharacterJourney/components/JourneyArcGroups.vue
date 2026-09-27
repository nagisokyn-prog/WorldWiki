<template>
  <div class="arc-groups-view space-y-6">
    <div
      v-for="group in arcGroups"
      :key="group.arcId"
      class="arc-group-card"
    >
      <div class="arc-group-header">
        <div class="flex items-center gap-2">
          <span
            class="arc-color-pill"
            :style="{ backgroundColor: group.arcColor || 'var(--color-accent)' }"
          ></span>
          <span class="font-bold text-sm text-main">{{ group.arcTitle }}</span>
        </div>
        <span class="text-xs text-muted">
          {{ group.items.length }} сцен
        </span>
      </div>

      <div class="p-4 space-y-3">
        <div
          v-for="item in group.items"
          :key="item.id"
          class="journey-card p-3 rounded border border-subtle bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
          @click="$emit('select-scene', item)"
        >
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="font-semibold text-sm text-main">{{ item.title }}</span>
            <div class="flex items-center gap-1.5">
              <span
                v-if="item.isFlashback"
                class="flashback-indicator"
                title="Хронология события идет вспять относительно повествования"
              >
                ⏪ Флэшбек
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

          <div v-if="item.description" class="text-xs text-main opacity-90 mt-1 p-2 rounded bg-input border border-subtle">
            {{ item.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArcGroup, JourneyTimelineItem } from '../CharacterJourney.model';

defineProps<{
  arcGroups: ArcGroup[];
}>();

defineEmits<{
  (e: 'select-scene', item: JourneyTimelineItem): void;
}>();
</script>
