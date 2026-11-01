<template>
  <div class="matrix-container">
    <!-- Matrix Toolbar -->
    <div class="matrix-toolbar">
      <div class="matrix-toolbar-title">
        <h2 class="matrix-title">
          <span class="matrix-icon">📊</span>
          <span>Матрица Участий</span>
        </h2>
        <span v-if="rows.length" class="matrix-badge">
          {{ rows.length }} сущн. / {{ chapters.length }} глав
        </span>
      </div>

      <div class="matrix-toolbar-controls">
        <input
          v-model="filters.searchQuery"
          type="text"
          placeholder="Поиск сущности..."
          class="matrix-search-input"
        />

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
          @click="refresh"
        >
          🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <!-- Matrix Legend -->
    <div class="matrix-legend">
      <div class="legend-chip">
        <span class="legend-marker marker-scene">●</span>
        <span>Сцена / Прямое участие</span>
      </div>
      <div class="legend-chip">
        <span class="legend-marker marker-mention">○</span>
        <span>Упоминание ((Имя))</span>
      </div>
      <div class="legend-chip">
        <span class="legend-marker marker-absent">—</span>
        <span>Отсутствует</span>
      </div>
      <div class="legend-chip">
        <span class="legend-marker">💀</span>
        <span>Погиб</span>
      </div>
      <div class="legend-chip legend-chip-warning">
        <span>⚠️</span>
        <span>Провал повествования (3+ глав)</span>
      </div>
    </div>

    <!-- Matrix Viewport -->
    <div class="matrix-viewport">
      <div v-if="isLoading && !rows.length" class="matrix-empty">
        <div class="empty-spinner">📊</div>
        <p>Загрузка матрицы связей...</p>
      </div>

      <div v-else-if="!rows.length" class="matrix-empty">
        <div class="empty-icon">📂</div>
        <p>Нет данных для отображения.</p>
        <span class="empty-hint">Убедитесь, что в главах созданы сцены или упоминания ((Сущностей)).</span>
      </div>

      <div v-else class="matrix-table-wrapper">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="matrix-th sticky-corner">
                <span class="th-label">Сущность</span>
              </th>
              <th class="matrix-th sticky-top th-total">
                <span class="th-label">Итого</span>
              </th>
              <th
                v-for="(ch, idx) in chapters"
                :key="ch.id"
                class="matrix-th sticky-top th-chapter"
                :title="ch.title + ' (' + (ch.word_count || 0) + ' сл.)'"
              >
                <div class="chapter-header-box">
                  <span class="chapter-order-badge">Глава {{ ch.sort_order || (idx + 1) }}</span>
                  <span class="chapter-title-text">{{ ch.title }}</span>
                  <span class="chapter-word-pill">{{ formatWordCount(ch.word_count) }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.entity.id"
              class="matrix-row"
              :class="{ 'row-gap-warning': row.hasGapWarning }"
            >
              <td class="matrix-td sticky-left matrix-entity-cell">
                <div class="entity-name-box">
                  <div class="entity-title-group">
                    <span class="entity-name" :title="row.entity.name">{{ row.entity.name }}</span>
                    <span v-if="row.entity.role_in_story" class="entity-role-badge" :title="'Роль: ' + row.entity.role_in_story">
                      {{ row.entity.role_in_story }}
                    </span>
                  </div>
                  <span v-if="row.hasGapWarning" class="matrix-gap-badge" title="Персонаж пропал на 3+ главы подряд!">⚠️ Разрыв</span>
                </div>
              </td>
              <td class="matrix-td matrix-total-cell" :title="`Сцен: ${row.totalScenes}, Упоминаний: ${row.totalMentions}`">
                <div class="matrix-total-group">
                  <span class="matrix-total-badge">{{ row.totalAppearances }}</span>
                  <div v-if="row.totalScenes > 0 || row.totalMentions > 0" class="matrix-total-sub">
                    <span v-if="row.totalScenes > 0" class="sub-scene" title="Сцены">●{{ row.totalScenes }}</span>
                    <span v-if="row.totalMentions > 0" class="sub-mention" title="Упоминания">○{{ row.totalMentions }}</span>
                  </div>
                </div>
              </td>
              <td
                v-for="ch in chapters"
                :key="ch.id"
                class="matrix-td matrix-cell"
                :title="row.entity.name + ' в ' + ch.title + ': ' + (row.cells.get(ch.id)?.label || '')"
              >
                <div v-if="row.cells.get(ch.id)?.hasScene || row.cells.get(ch.id)?.hasMention" class="cell-badges-group">
                  <span v-if="row.cells.get(ch.id)?.hasScene" class="cell-badge cell-scene" title="Сцена / Прямое участие">●</span>
                  <span v-if="row.cells.get(ch.id)?.hasMention" class="cell-badge cell-mention" title="Упоминание ((Имя))">○</span>
                </div>
                <span v-else-if="row.cells.get(ch.id)?.isDeceased" class="cell-badge cell-deceased" title="Погиб">💀</span>
                <span v-else class="cell-badge cell-absent">—</span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="matrix-row matrix-summary-row">
              <td class="matrix-td sticky-left matrix-entity-cell">
                <span class="matrix-summary-label">👥 Участников в главе:</span>
              </td>
              <td class="matrix-td matrix-total-cell" :title="'Всего участий: ' + totalProjectAppearances">
                <span class="matrix-total-badge">{{ totalProjectAppearances }}</span>
              </td>
              <td
                v-for="ch in chapters"
                :key="'footer-' + ch.id"
                class="matrix-td matrix-cell matrix-summary-cell"
                :title="`Глава ${ch.sort_order}: ${chapterStats.get(ch.id)?.total || 0} участников (● ${chapterStats.get(ch.id)?.scenes || 0}, ○ ${chapterStats.get(ch.id)?.mentions || 0})`"
              >
                <div class="chapter-summary-box">
                  <span class="summary-total">{{ chapterStats.get(ch.id)?.total || 0 }}</span>
                  <div v-if="(chapterStats.get(ch.id)?.total || 0) > 0" class="summary-sub">
                    <span v-if="(chapterStats.get(ch.id)?.scenes || 0) > 0" class="sub-scene" title="В сценах">●{{ chapterStats.get(ch.id)?.scenes }}</span>
                    <span v-if="(chapterStats.get(ch.id)?.mentions || 0) > 0" class="sub-mention" title="В упоминаниях">○{{ chapterStats.get(ch.id)?.mentions }}</span>
                  </div>
                </div>
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

const props = withDefaults(
  defineProps<CrossReferenceMatrixProps>(),
  {
    project: '',
  }
);

const {
  filters,
  chapters,
  rows,
  availableEntityTypes,
  chapterStats,
  totalProjectAppearances,
  isLoading,
  refresh,
  formatWordCount,
} = useCrossReferenceMatrix(props.project);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/CrossReferenceMatrix.css"></style>
