<template>
  <div class="audit-summary-header flex flex-wrap items-center justify-between gap-4 p-4 border-b border-subtle bg-surface">
    <div class="flex items-center gap-3">
      <div class="header-icon-wrap p-2 rounded-lg bg-surface-hover text-xl flex items-center justify-center">
        🛡️
      </div>
      <div>
        <h2 class="text-base font-bold m-0 flex items-center gap-2 text-main">
          Инспектор Противоречий Лора
        </h2>
        <p class="text-2xs text-muted m-0">
          Автоматический аудит хронологической и сюжетной целостности рукописи
        </p>
      </div>
    </div>

    <!-- Health Score & Badges -->
    <div class="flex items-center gap-3">
      <div class="health-bar-container flex items-center gap-2 px-3 py-1.5 rounded-lg border border-subtle bg-surface">
        <span class="text-xs text-muted font-mono">Здоровье:</span>
        <div class="health-pill flex items-center gap-1.5 font-bold text-xs" :class="healthScoreClass">
          <span class="text-sm">{{ healthIcon }}</span>
          <span>{{ summary.healthyPercent }}%</span>
        </div>
      </div>

      <div class="flex items-center gap-1.5 text-xs font-mono">
        <span
          v-if="summary.criticalCount > 0"
          class="badge-stat badge-critical px-2.5 py-1 rounded-md font-bold flex items-center gap-1"
        >
          💀 {{ summary.criticalCount }}
        </span>
        <span
          v-if="summary.warningCount > 0"
          class="badge-stat badge-warning px-2.5 py-1 rounded-md font-bold flex items-center gap-1"
        >
          ⚡ {{ summary.warningCount }}
        </span>
        <span
          v-if="summary.noticeCount > 0"
          class="badge-stat badge-notice px-2.5 py-1 rounded-md font-bold flex items-center gap-1"
        >
          ⏳ {{ summary.noticeCount }}
        </span>
        <span
          v-if="summary.total === 0"
          class="badge-stat badge-success px-2.5 py-1 rounded-md font-bold text-success flex items-center gap-1"
        >
          ✨ Идеально
        </span>
      </div>

      <button
        class="btn-refresh-audit px-3 py-1.5 rounded-md font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all"
        :disabled="isAuditing"
        @click="$emit('refresh')"
      >
        <span :class="{ 'animate-spin': isAuditing }">🔄</span>
        <span>{{ isAuditing ? 'Анализ...' : 'Сканировать' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuditSummaryHeaderProps, AuditSummaryHeaderEmits } from './AuditSummaryHeader.model';
import { useAuditSummaryHeader } from './useAuditSummaryHeader';

const props = defineProps<AuditSummaryHeaderProps>();

defineEmits<AuditSummaryHeaderEmits>();

const { healthIcon, healthScoreClass } = useAuditSummaryHeader(() => props.summary);
</script>
