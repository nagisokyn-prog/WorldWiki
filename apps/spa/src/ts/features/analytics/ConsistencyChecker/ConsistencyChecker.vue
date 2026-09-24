<template>
  <div class="consistency-container flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- Toolbar -->
    <div class="consistency-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-subtle bg-surface">
      <div class="flex items-center gap-3">
        <h2 class="text-base font-bold m-0 flex items-center gap-2">
          <span>🛡️</span> Детектор Сюжетных Противоречий
        </h2>
        <div class="flex items-center gap-1.5 text-xs">
          <span v-if="summary.criticalCount" class="badge-count px-2 py-0.5 rounded font-bold bg-danger text-surface">
            🔴 {{ summary.criticalCount }} крит.
          </span>
          <span v-if="summary.warningCount" class="badge-count px-2 py-0.5 rounded font-bold bg-warning text-surface">
            🟡 {{ summary.warningCount }} предупр.
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="filterSeverity"
          class="text-xs px-2 py-1.5 rounded border border-subtle bg-input text-main"
        >
          <option value="all">Все уровни</option>
          <option value="critical">🔴 Только критические</option>
          <option value="warning">🟡 Только предупреждения</option>
        </select>

        <button
          class="btn-audit text-xs px-3 py-1.5 rounded font-bold bg-accent text-surface cursor-pointer"
          :disabled="isAuditing"
          @click="runAudit"
        >
          🔍 {{ isAuditing ? 'Сканирование...' : 'Запустить аудит' }}
        </button>
      </div>
    </div>

    <!-- Violations List -->
    <div class="consistency-body flex-1 overflow-y-auto p-6 space-y-3">
      <div v-if="isAuditing && !violations.length" class="flex items-center justify-center h-48 text-muted text-sm">
        Анализ нарративной целостности рукописи...
      </div>

      <div v-else-if="!violations.length" class="flex flex-col items-center justify-center h-48 text-muted text-sm space-y-2">
        <span class="text-2xl">✨</span>
        <span class="font-bold text-success">Сюжетных противоречий не обнаружено!</span>
        <span class="text-xs">Все персонажи, ружья и события согласованы по времени.</span>
      </div>

      <div
        v-for="v in filteredViolations"
        :key="v.rule_id + (v.entity_id || '') + (v.chapter_id || '')"
        class="violation-card p-4 rounded-lg border border-subtle bg-surface hover:bg-surface-hover transition-colors flex flex-col gap-2"
        :class="'severity-' + v.severity"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-xs flex items-center gap-1.5">
            <span>{{ v.severity === 'critical' ? '🔴' : '🟡' }}</span>
            <span>{{ v.title }}</span>
          </span>
          <span class="badge text-2xs px-2 py-0.5 rounded font-mono uppercase" :class="'badge-' + v.severity">
            {{ v.severity }}
          </span>
        </div>

        <p class="text-xs text-main m-0 opacity-90 leading-relaxed">
          {{ v.description }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConsistencyChecker } from './useConsistencyChecker';

const props = withDefaults(
  defineProps<{
    projectId?: string;
  }>(),
  {
    projectId: '',
  }
);

const {
  violations,
  filteredViolations,
  filterSeverity,
  summary,
  isAuditing,
  runAudit,
} = useConsistencyChecker(props.projectId);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ConsistencyChecker.css"></style>

