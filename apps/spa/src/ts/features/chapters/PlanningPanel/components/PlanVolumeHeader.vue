<template>
  <div class="plan-volume-header pb-2 mb-2 border-b border-border">
    <!-- Clickable Header with Collapse Toggle & Progress -->
    <div
      class="flex items-center justify-between mb-1.5 cursor-pointer select-none hover:opacity-90 transition-opacity"
      title="Нажмите, чтобы скрыть или развернуть главы тома"
      @click="handleToggle"
    >
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="text-muted text-xs transition-transform duration-200">
          {{ isCollapsed ? '▸' : '▼' }}
        </span>
        <span class="volume-header-icon text-base">📚</span>
        <span class="volume-header-title font-semibold text-sm text-main truncate" :title="title">
          {{ title }}
        </span>
      </div>
      <div class="volume-header-pct font-bold text-xs text-accent">
        {{ progressPct }}%
      </div>
    </div>

    <!-- Continuous Progress Bar -->
    <div class="volume-progress-bar w-full h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
      <div
        class="volume-progress-fill h-full bg-accent transition-all duration-300"
        :style="{ width: progressPct + '%' }"
      ></div>
    </div>

    <!-- Status Badges -->
    <div class="volume-status-chips flex items-center gap-1.5 flex-wrap text-[11px]">
      <span v-if="stats.inProgress > 0" class="chip-status chip-warning" title="Задач в работе">
        🟡 {{ stats.inProgress }} в работе
      </span>
      <span v-if="stats.done > 0" class="chip-status chip-success" title="Завершенных задач">
        🟢 {{ stats.done }} готово
      </span>
      <span v-if="stats.planned > 0" class="chip-status chip-neutral" title="Задач в планах">
        ⚪ {{ stats.planned }} в планах
      </span>
      <span v-if="stats.blocked > 0" class="chip-status chip-blocked" title="Заблокированных задач">
        🔒 {{ stats.blocked }} ждёт
      </span>
      <span v-if="stats.total === 0" class="text-xs text-muted">
        Нет задач
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanVolumeHeaderProps, PlanVolumeHeaderEmits } from './PlanVolumeHeader.model';
import { usePlanVolumeHeader } from './usePlanVolumeHeader';

const props = withDefaults(defineProps<PlanVolumeHeaderProps>(), {
  isCollapsed: false
});
const emit = defineEmits<PlanVolumeHeaderEmits>();

const { progressPct, handleToggle } = usePlanVolumeHeader(props, emit);
</script>
