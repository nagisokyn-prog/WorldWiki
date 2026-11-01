<template>
  <div class="consistency-checker-root flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- 1. Header Summary -->
    <AuditSummaryHeader
      :summary="summary"
      :is-auditing="isAuditing"
      @refresh="runAudit"
    />

    <!-- View Switcher Bar -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-subtle bg-surface">
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors"
          :class="currentView === 'anomalies' ? 'bg-surface-hover text-accent border border-subtle' : 'text-muted hover:text-main'"
          @click="currentView = 'anomalies'"
        >
          📋 Нарушения ({{ filteredAnomalies.length }})
        </button>
        <button
          class="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors"
          :class="currentView === 'chapters' ? 'bg-surface-hover text-accent border border-subtle' : 'text-muted hover:text-main'"
          @click="currentView = 'chapters'"
        >
          📖 По главам ({{ chapterViolations.length }})
        </button>
      </div>
    </div>

    <!-- 2. Filters Toolbar (for anomalies view) -->
    <AuditFilterToolbar
      v-if="currentView === 'anomalies'"
      v-model:search-query="searchQuery"
      v-model:selected-severity="selectedSeverity"
      v-model:selected-rule="selectedRule"
      :has-active-filters="hasActiveFilters"
      @reset-filters="resetFilters"
    />

    <!-- 3. Body -->
    <div class="consistency-body flex-1 overflow-y-auto p-4 space-y-3">
      <!-- Loading State -->
      <div
        v-if="isAuditing && !anomalies.length"
        class="flex flex-col items-center justify-center h-48 text-muted text-sm space-y-2"
      >
        <span class="text-2xl animate-spin">🔄</span>
        <span>Сканирование хронологии и сюжета рукописи...</span>
      </div>

      <!-- Clean State: Zero Violations -->
      <div
        v-else-if="!anomalies.length"
        class="empty-state-card flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-subtle bg-surface space-y-3"
      >
        <div class="p-3 rounded-full bg-surface-hover text-3xl">
          ✨
        </div>
        <div>
          <h3 class="text-base font-bold text-success m-0">
            Сюжетных противоречий не обнаружено!
          </h3>
          <p class="text-xs text-muted m-0 mt-1 max-w-sm">
            Все перемещения персонажей, фазы жизни, ружья и события согласованы по времени и пространству.
          </p>
        </div>
      </div>

      <!-- Chapters View Table -->
      <div
        v-else-if="currentView === 'chapters'"
        class="audit-chapter-table-wrapper rounded-xl border border-subtle bg-surface overflow-hidden"
      >
        <table class="audit-chapter-table">
          <thead>
            <tr>
              <th>Глава</th>
              <th>Всего проблем</th>
              <th>💀 Критических</th>
              <th>⚡ Предупреждений</th>
              <th>⏳ Заметок</th>
              <th style="text-align: right;">Действие</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ch in chapterViolations"
              :key="ch.chapterId"
              class="audit-chapter-row"
              @click="$emit('jumpToChapter', ch.chapterId)"
            >
              <td class="font-bold">
                <span class="text-accent mr-1">#{{ ch.order }}</span>
                <span>{{ ch.title }}</span>
              </td>
              <td>
                <span class="font-bold">{{ ch.total }}</span>
              </td>
              <td>
                <span v-if="ch.critical > 0" class="badge-critical px-2 py-0.5 rounded text-2xs font-bold">
                  {{ ch.critical }}
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <span v-if="ch.warning > 0" class="badge-warning px-2 py-0.5 rounded text-2xs font-bold">
                  {{ ch.warning }}
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <span v-if="ch.notice > 0" class="badge-notice px-2 py-0.5 rounded text-2xs font-bold">
                  {{ ch.notice }}
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td style="text-align: right;">
                <button
                  class="btn-action text-xs px-2.5 py-1 rounded bg-surface-hover text-accent border border-subtle cursor-pointer hover:border-accent"
                  @click.stop="$emit('jumpToChapter', ch.chapterId)"
                >
                  📍 Открыть
                </button>
              </td>
            </tr>
            <tr v-if="!chapterViolations.length">
              <td colspan="6" class="text-center py-6 text-muted">
                В главах нет привязанных нарушений
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State: Filter Matched Nothing -->
      <div
        v-else-if="filteredAnomalies.length === 0"
        class="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-subtle bg-surface text-muted text-xs space-y-2"
      >
        <span class="text-xl">🔍</span>
        <span>По заданным фильтрам аномалий не найдено</span>
        <button
          class="btn-reset text-xs text-accent font-semibold underline cursor-pointer"
          @click="resetFilters"
        >
          Сбросить фильтры
        </button>
      </div>

      <!-- Anomaly Cards List -->
      <div v-else class="space-y-3">
        <AuditAnomalyCard
          v-for="(item, idx) in filteredAnomalies"
          :key="item.rule + '_' + (item.entity_ids?.[0] || '') + '_' + (item.chapter_ids?.[0] || '') + '_' + idx"
          :anomaly="item"
          @jump-to-chapter="$emit('jumpToChapter', $event)"
          @open-entity="$emit('openEntity', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConsistencyCheckerProps, ConsistencyCheckerEmits } from './ConsistencyChecker.model';
import { useConsistencyChecker } from './useConsistencyChecker';
import AuditSummaryHeader from './components/AuditSummaryHeader.vue';
import AuditFilterToolbar from './components/AuditFilterToolbar.vue';
import AuditAnomalyCard from './components/AuditAnomalyCard.vue';

const props = withDefaults(
  defineProps<ConsistencyCheckerProps>(),
  {
    projectId: '',
    project: '',
  }
);

defineEmits<ConsistencyCheckerEmits>();

const {
  currentView,
  chapterViolations,
  anomalies,
  filteredAnomalies,
  searchQuery,
  selectedSeverity,
  selectedRule,
  hasActiveFilters,
  summary,
  isAuditing,
  resetFilters,
  runAudit,
} = useConsistencyChecker(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ConsistencyChecker.css"></style>
