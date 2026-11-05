<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden p-2">
    <PlanningPanel
      :project="project"
      :volume-id="currentVolume?.id"
      :volume-title="currentVolume?.title"
      :current-chapter-id="currentChapterId"
      :current-chapter-title="currentChapter?.title"
      :arcs-list="arcsList"
      :selected-arc-filter="selectedArcId"
      @select-arc="$emit('select-arc', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { PlanningMatrixTabProps, PlanningMatrixTabEmits } from './PlanningMatrixTab.model';
import PlanningPanel from '@/features/chapters/components/panels/PlanningPanel/PlanningPanel.vue';

defineProps<PlanningMatrixTabProps>();
defineEmits<PlanningMatrixTabEmits>();
</script>
