<template>
  <div class="matrix-toolbar">
    <div class="matrix-toolbar-title">
      <h2 class="matrix-title">
        <span class="matrix-icon">📊</span>
        <span>Матрица Участий</span>
      </h2>
      <span v-if="rowsCount" class="matrix-badge">
        {{ rowsCount }} сущн. / {{ chaptersCount }} глав
      </span>
    </div>

    <div class="matrix-toolbar-controls">
      <div class="matrix-search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="filters.searchQuery"
          type="text"
          placeholder="Поиск сущности..."
          class="matrix-search-input"
        />
      </div>

      <select
        v-model="filters.selectedEntityType"
        class="matrix-select"
      >
        <option value="all">Все типы</option>
        <option v-for="t in availableEntityTypes" :key="t" :value="t">{{ t }}</option>
      </select>

      <label class="matrix-checkbox-label">
        <input v-model="filters.highlightGaps" type="checkbox" class="matrix-checkbox" />
        <span>Подсветка разрывов (3+ глав)</span>
      </label>

      <button
        class="btn-refresh"
        :disabled="isLoading"
        @click="$emit('refresh')"
      >
        🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MatrixToolbarProps, MatrixToolbarEmits } from './MatrixToolbar.model';

defineProps<MatrixToolbarProps>();
defineEmits<MatrixToolbarEmits>();
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/CrossReferenceMatrix.css"></style>
