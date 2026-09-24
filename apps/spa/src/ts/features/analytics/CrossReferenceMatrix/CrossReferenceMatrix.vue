<template>
  <div class="matrix-container flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- Matrix Toolbar -->
    <div class="matrix-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-subtle bg-surface">
      <div class="flex items-center gap-3">
        <h2 class="text-base font-bold m-0 flex items-center gap-2">
          <span>📊</span> Матрица Участий
        </h2>
        <span v-if="rows.length" class="badge-count text-xs px-2 py-0.5 rounded bg-surface-hover text-muted">
          {{ rows.length }} сущн. / {{ chapters.length }} глав
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="filters.searchQuery"
          type="text"
          placeholder="Поиск сущности..."
          class="matrix-search-input text-xs px-3 py-1.5 rounded border border-subtle bg-input text-main"
        />

        <select
          v-model="filters.selectedEntityType"
          class="matrix-select text-xs px-2 py-1.5 rounded border border-subtle bg-input text-main"
        >
          <option value="all">Все типы</option>
          <option v-for="t in availableEntityTypes" :key="t" :value="t">{{ t }}</option>
        </select>

        <label class="matrix-checkbox-label flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
          <input v-model="filters.highlightGaps" type="checkbox" class="cursor-pointer" />
          <span>Подсветка разрывов (3+ глав)</span>
        </label>

        <button
          class="btn-refresh text-xs px-3 py-1.5 rounded border border-subtle bg-surface-hover hover:bg-surface text-main cursor-pointer"
          :disabled="isLoading"
          @click="refresh"
        >
          🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <!-- Matrix Legend -->
    <div class="matrix-legend flex flex-wrap items-center gap-4 px-4 py-2 border-b border-subtle text-xs bg-surface-subtle text-muted">
      <div class="flex items-center gap-1.5">
        <span class="status-dot dot-scene">●</span>
        <span>Сцена / Прямое участие</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="status-dot dot-mention">○</span>
        <span>Упоминание ((Имя))</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="status-dot dot-absent">—</span>
        <span>Отсутствует</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="status-dot dot-deceased">💀</span>
        <span>Погиб</span>
      </div>
      <div class="flex items-center gap-1.5 ml-auto">
        <span class="gap-indicator">⚠️</span>
        <span>Провал повествования</span>
      </div>
    </div>

    <!-- Matrix Table Area -->
    <div class="matrix-viewport flex-1 overflow-auto p-4">
      <div v-if="isLoading && !rows.length" class="flex items-center justify-center h-48 text-muted text-sm">
        Загрузка матрицы связей...
      </div>

      <div v-else-if="!rows.length" class="flex items-center justify-center h-48 text-muted text-sm">
        Нет данных для отображения. Убедитесь, что в главах созданы сцены или упоминания ((Сущностей)).
      </div>

      <div v-else class="matrix-table-wrapper inline-block min-w-full">
        <table class="matrix-table border-collapse text-xs">
          <thead>
            <tr>
              <th class="sticky-header sticky-left-corner p-2 text-left bg-surface border border-subtle min-w-44 z-20">
                Сущность
              </th>
              <th class="sticky-header p-2 text-center bg-surface border border-subtle w-16 z-10">
                Итого
              </th>
              <th
                v-for="ch in chapters"
                :key="ch.id"
                class="sticky-header p-2 text-center bg-surface border border-subtle min-w-24 max-w-32 truncate z-10"
                :title="ch.title + ' (' + ch.word_count + ' сл.)'"
              >
                <div class="font-bold truncate">{{ ch.title }}</div>
                <div class="text-2xs text-muted">#{{ ch.sort_order }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.entity.id"
              class="matrix-row hover:bg-surface-hover"
              :class="{ 'row-gap-warning': row.hasGapWarning }"
            >
              <td class="sticky-col p-2 bg-surface border border-subtle font-medium truncate flex items-center justify-between">
                <span class="truncate" :title="row.entity.name">{{ row.entity.name }}</span>
                <span v-if="row.hasGapWarning" class="ml-1 text-warning" title="Персонаж пропал на 3+ главы подряд!">⚠️</span>
              </td>
              <td class="p-2 text-center border border-subtle font-bold text-accent">
                {{ row.totalAppearances }}
              </td>
              <td
                v-for="ch in chapters"
                :key="ch.id"
                class="p-2 text-center border border-subtle matrix-cell"
                :class="'cell-' + (row.cells.get(ch.id)?.status || 'absent')"
                :title="row.entity.name + ' в ' + ch.title + ': ' + (row.cells.get(ch.id)?.label || '')"
              >
                <span v-if="row.cells.get(ch.id)?.status === 'scene'" class="status-glyph glyph-scene">●</span>
                <span v-else-if="row.cells.get(ch.id)?.status === 'mention'" class="status-glyph glyph-mention">○</span>
                <span v-else-if="row.cells.get(ch.id)?.status === 'deceased'" class="status-glyph glyph-deceased">💀</span>
                <span v-else class="status-glyph glyph-absent">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCrossReferenceMatrix } from './useCrossReferenceMatrix';

const props = withDefaults(
  defineProps<{
    project?: string;
  }>(),
  {
    project: '',
  }
);

const {
  filters,
  chapters,
  rows,
  availableEntityTypes,
  isLoading,
  refresh,
} = useCrossReferenceMatrix(props.project);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/CrossReferenceMatrix.css"></style>

