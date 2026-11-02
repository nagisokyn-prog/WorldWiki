<template>
  <div class="plan-volume-header">
    <!-- Clickable Header with Collapse Toggle & Progress -->
    <div
      class="volume-header-row"
      title="Нажмите, чтобы скрыть или развернуть главы тома"
      @click="handleToggle"
    >
      <div class="volume-header-left">
        <span class="volume-collapse-icon">
          {{ isCollapsed ? '▸' : '▼' }}
        </span>
        <span class="volume-header-icon">📚</span>
        <span class="volume-header-title" :title="title">
          {{ title }}
        </span>
      </div>
      <div class="volume-header-pct">
        {{ progressPct }}%
      </div>
    </div>

    <!-- Continuous Progress Bar -->
    <div class="volume-progress-bar">
      <div
        class="volume-progress-fill"
        :style="{ width: progressPct + '%' }"
      ></div>
    </div>

    <!-- Status Badges -->
    <div class="volume-status-chips">
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
      <span v-if="stats.total === 0" class="chip-status-empty">
        Нет задач
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanVolumeHeaderProps, PlanVolumeHeaderEmits } from './PlanVolumeHeader.model';
import { usePlanVolumeHeader } from './usePlanVolumeHeader';

const props = withDefaults(defineProps<PlanVolumeHeaderProps>(), {
  isCollapsed: false,
});
const emit = defineEmits<PlanVolumeHeaderEmits>();

const { progressPct, handleToggle } = usePlanVolumeHeader(props, emit);
</script>
