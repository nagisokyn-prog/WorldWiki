<template>
  <div class="audit-filter-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-subtle bg-surface">
    <!-- Search Bar -->
    <div class="search-wrap relative flex-1 min-w-[200px] max-w-[360px]">
      <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs">🔍</span>
      <input
        :value="searchQuery"
        type="text"
        placeholder="Поиск по названию или описанию..."
        class="search-input w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-subtle bg-input text-main placeholder:text-muted focus:outline-none focus:border-accent"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Filters Group -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Severity Filter -->
      <select
        :value="selectedSeverity"
        class="filter-select text-xs px-2.5 py-1.5 rounded-md border border-subtle bg-input text-main cursor-pointer"
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
        class="filter-select text-xs px-2.5 py-1.5 rounded-md border border-subtle bg-input text-main cursor-pointer"
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
        class="btn-reset-filters text-2xs px-2.5 py-1.5 rounded-md text-muted hover:text-main bg-surface-hover border border-subtle cursor-pointer transition-colors"
        @click="$emit('resetFilters')"
      >
        ✕ Сбросить
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuditFilterToolbar } from './useAuditFilterToolbar';

defineProps<{
  searchQuery: string;
  selectedSeverity: string;
  selectedRule: string;
  hasActiveFilters: boolean;
}>();

defineEmits<{
  (e: 'update:searchQuery', val: string): void;
  (e: 'update:selectedSeverity', val: string): void;
  (e: 'update:selectedRule', val: string): void;
  (e: 'resetFilters'): void;
}>();

useAuditFilterToolbar();
</script>
