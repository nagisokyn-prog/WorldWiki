<template>
  <div class="consistency-checker-root flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- 1. Header Summary -->
    <AuditSummaryHeader
      :summary="summary"
      :is-auditing="isAuditing"
      @refresh="runAudit"
    />

    <!-- 2. Filters Toolbar -->
    <AuditFilterToolbar
      v-model:search-query="searchQuery"
      v-model:selected-severity="selectedSeverity"
      v-model:selected-rule="selectedRule"
      :has-active-filters="hasActiveFilters"
      @reset-filters="resetFilters"
    />

    <!-- 3. Anomaly Feed Body -->
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
      <AuditAnomalyCard
        v-for="(item, idx) in filteredAnomalies"
        :key="item.rule + '_' + (item.entity_ids?.[0] || '') + '_' + (item.chapter_ids?.[0] || '') + '_' + idx"
        :anomaly="item"
        @jump-to-chapter="$emit('jumpToChapter', $event)"
        @open-entity="$emit('openEntity', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConsistencyChecker } from './useConsistencyChecker';
import AuditSummaryHeader from './components/AuditSummaryHeader.vue';
import AuditFilterToolbar from './components/AuditFilterToolbar.vue';
import AuditAnomalyCard from './components/AuditAnomalyCard.vue';

const props = withDefaults(
  defineProps<{
    projectId?: string;
  }>(),
  {
    projectId: '',
  }
);

defineEmits<{
  (e: 'jumpToChapter', chapterId: string): void;
  (e: 'openEntity', entityId: string): void;
}>();

const {
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
} = useConsistencyChecker(props.projectId);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ConsistencyChecker.css"></style>
