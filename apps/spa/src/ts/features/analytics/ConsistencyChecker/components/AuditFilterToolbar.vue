<template>
  <div class="audit-filter-toolbar">
    <!-- Search Bar -->
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input
        :value="searchQuery"
        type="text"
        placeholder="Поиск по названию или описанию..."
        class="search-input"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Filters Group -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Severity Filter -->
      <select
        :value="selectedSeverity"
        class="filter-select"
        @change="$emit('update:selectedSeverity', ($event.target as HTMLSelectElement).value)"
      >
        <option value="all">Все уровни строгости</option>
        <option value="critical">🔴 Критические (CRITICAL)</option>
        <option value="warning">🟡 Предупреждения (WARNING)</option>
        <option value="notice">🔵 Уведомления (NOTICE)</option>
      </select>

      <!-- Rule Type Filter -->
      <select
        :value="selectedRule"
        class="filter-select"
        @change="$emit('update:selectedRule', ($event.target as HTMLSelectElement).value)"
      >
        <option value="all">Все типы правил</option>
        <option value="deceased_entity_active">💀 Действие после смерти</option>
        <option value="action_before_birth">👶 Действие до рождения</option>
        <option value="entity_bilocation">⚡ Временная билокация</option>
        <option value="forgotten_item">🗡️ Забытый предмет (Чеховское ружьё)</option>
        <option value="chain_of_custody_violation">👑 Разрыв цепочки владения</option>
        <option value="reveal_before_event">🔄 Анахронизм раскрытия</option>
        <option value="forgotten_plot_promise">⏳ Сюжетный долг</option>
        <option value="destroyed_location_used">🏰 Разрушенная локация</option>
      </select>

      <!-- Reset Filters Button -->
      <button
        v-if="hasActiveFilters"
        class="btn-reset-filters"
        @click="$emit('resetFilters')"
      >
        ✕ Сбросить
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuditFilterToolbarProps, AuditFilterToolbarEmits } from './AuditFilterToolbar.model';
import { useAuditFilterToolbar } from './useAuditFilterToolbar';

defineProps<AuditFilterToolbarProps>();

defineEmits<AuditFilterToolbarEmits>();

useAuditFilterToolbar();
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ConsistencyChecker.css"></style>
