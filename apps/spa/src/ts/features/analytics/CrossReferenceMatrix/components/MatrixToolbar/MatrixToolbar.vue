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

      <XboxWheel
        v-if="volumeOptions && volumeOptions.length > 1"
        v-model="filters.selectedVolumeId"
        :options="volumeWheelOptions"
        compact
        title="Фильтр по томам"
      />

      <XboxWheel
        v-model="filters.selectedEntityType"
        :options="entityTypeWheelOptions"
        compact
      />

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
import { XboxWheel } from '@worldwiki/components';
import type { MatrixToolbarProps, MatrixToolbarEmits } from './MatrixToolbar.model';
import { useMatrixToolbar } from './useMatrixToolbar';

const props = defineProps<MatrixToolbarProps>();
defineEmits<MatrixToolbarEmits>();

const { volumeWheelOptions, entityTypeWheelOptions } = useMatrixToolbar(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/CrossReferenceMatrix.css"></style>
