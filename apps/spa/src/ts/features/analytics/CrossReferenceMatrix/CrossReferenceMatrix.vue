<template>
  <div class="matrix-container">
    <!-- Matrix Toolbar -->
    <MatrixToolbar
      :filters="filters"
      :available-entity-types="availableEntityTypes"
      :rows-count="rows.length"
      :chapters-count="chapters.length"
      :is-loading="isLoading"
      @refresh="refresh"
    />

    <!-- Matrix Legend -->
    <MatrixLegend />

    <!-- Matrix Viewport -->
    <div class="matrix-viewport">
      <div v-if="isLoading && !rows.length" class="matrix-empty">
        <div class="empty-spinner">📊</div>
        <p>Загрузка матрицы связей...</p>
      </div>

      <div v-else-if="!rows.length" class="matrix-empty">
        <p>Нет данных для отображения. Проверьте фильтры или добавьте сущности в главы.</p>
      </div>

      <div v-else class="matrix-table-wrapper">
        <table class="matrix-table">
          <!-- Thead: Главы -->
          <thead>
            <tr>
              <th class="matrix-th-corner">
                <span>Сущность \ Глава</span>
              </th>
              <th
                v-for="col in chapterColumns"
                :key="col.id"
                class="matrix-th-col"
                :title="col.title"
              >
                <div class="col-header-content">
                  <span class="col-order">{{ col.sort_order }}</span>
                  <span class="col-title">{{ col.title }}</span>
                  <span class="col-words">{{ col.formattedWordCount }}</span>
                </div>
              </th>
              <th class="matrix-th-total">Всего</th>
            </tr>
          </thead>

          <!-- Tbody: Сущности -->
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.entity.id"
              class="matrix-row"
              :class="{
                'row-has-gap': filters.highlightGaps && row.hasGapWarning,
                'row-is-dead': row.entity.is_deceased,
              }"
            >
              <!-- Фиксированная первая колонка с именем сущности -->
              <td class="matrix-td-entity">
                <div class="entity-info">
                  <span class="entity-name" :title="row.entity.name">{{ row.entity.name }}</span>
                  <span class="entity-type-badge">{{ row.entity.entity_type }}</span>
                  <span v-if="row.entity.is_deceased" class="dead-badge" title="Сущность мертва">💀</span>
                  <span
                    v-if="filters.highlightGaps && row.hasGapWarning"
                    class="gap-badge"
                    title="Провал в появлении: не упоминается 3+ глав подряд"
                  >
                    ⚠️
                  </span>
                </div>
              </td>

              <!-- Ячейки для каждой главы (прекомпутированный список ячеек) -->
              <td
                v-for="cell in row.cellList"
                :key="cell.chapterId"
                class="matrix-cell"
                :class="[
                  `status-${cell.status}`,
                  {
                    'cell-death': cell.isDeceased,
                  },
                ]"
                :title="cell.label"
              >
                <span v-if="cell.status === 'scene'" class="cell-marker marker-scene">●</span>
                <span v-else-if="cell.status === 'mention'" class="cell-marker marker-mention">○</span>
                <span v-else class="cell-marker marker-absent">—</span>

                <span v-if="cell.isDeceased" class="death-icon">💀</span>
              </td>

              <!-- Суммарная колонка справа -->
              <td class="matrix-td-row-total">
                <span class="row-total-badge">{{ row.totalAppearances }}</span>
              </td>
            </tr>
          </tbody>

          <!-- Tfoot: Суммарная статистика по главам -->
          <tfoot>
            <tr class="matrix-footer-row">
              <td class="matrix-footer-label">
                <span>Уникальных сущностей:</span>
              </td>
              <td
                v-for="col in chapterColumns"
                :key="`footer-${col.id}`"
                class="matrix-footer-cell"
              >
                <span>{{ col.uniqueEntities }}</span>
              </td>
              <td class="matrix-footer-grand-total">
                <span>{{ totalProjectAppearances }}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CrossReferenceMatrixProps } from './CrossReferenceMatrix.model';
import { useCrossReferenceMatrix } from './useCrossReferenceMatrix';
import MatrixToolbar from './components/MatrixToolbar.vue';
import MatrixLegend from './components/MatrixLegend.vue';

const props = withDefaults(
  defineProps<CrossReferenceMatrixProps>(),
  {
    project: '',
  }
);

const {
  filters,
  chapters,
  chapterColumns,
  rows,
  availableEntityTypes,
  totalProjectAppearances,
  isLoading,
  refresh,
} = useCrossReferenceMatrix(props.project);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/CrossReferenceMatrix.css"></style>
