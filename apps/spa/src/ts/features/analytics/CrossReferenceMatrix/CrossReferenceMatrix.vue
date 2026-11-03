<template>
  <div class="matrix-container">
    <!-- Matrix Toolbar -->
    <MatrixToolbar
      :filters="filters"
      :available-entity-types="availableEntityTypes"
      :volume-options="volumeOptions"
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
          <!-- Thead: Тома и Главы -->
          <thead>
            <!-- Superheader: Группировка по томам -->
            <tr v-if="volumeGroups.length > 0" class="matrix-volume-superheader">
              <th class="matrix-th sticky-corner-top">
                <span class="th-label">Том / Глава</span>
              </th>
              <th
                v-for="grp in volumeGroups"
                :key="'vol-hdr-' + grp.volumeId"
                class="matrix-th matrix-volume-th"
                :colspan="grp.chaptersCount"
              >
                <div class="matrix-volume-banner flex items-center justify-center gap-1.5 py-1 px-2 font-bold text-xs text-accent bg-accent/10 border-b border-border rounded-t">
                  <span>📚</span>
                  <span>{{ grp.volumeTitle }}</span>
                  <span class="text-[10px] text-muted font-normal">({{ grp.chaptersCount }} гл.)</span>
                </div>
              </th>
              <th class="matrix-th th-total sticky-top" :rowspan="2">
                <span class="th-label">Всего</span>
              </th>
            </tr>

            <!-- Главы -->
            <tr>
              <th class="matrix-th sticky-corner">
                <span class="th-label">Сущность \ Глава</span>
              </th>
              <th
                v-for="col in chapterColumns"
                :key="col.id"
                class="matrix-th sticky-top th-chapter"
                :title="col.title"
              >
                <div class="chapter-header-box">
                  <span class="chapter-order-badge">Гл. #{{ col.sort_order }}</span>
                  <span class="chapter-title-text">{{ col.title }}</span>
                  <span class="chapter-word-pill">{{ col.formattedWordCount }}</span>
                </div>
              </th>
              <th v-if="volumeGroups.length === 0" class="matrix-th sticky-top th-total">
                <span class="th-label">Всего</span>
              </th>
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
              <td class="matrix-td sticky-left matrix-entity-cell">
                <div class="entity-name-box">
                  <div class="entity-title-group">
                    <span class="entity-icon">{{ row.icon }}</span>
                    <span class="entity-name" :title="row.entity.name">{{ row.entity.name }}</span>
                    <span class="entity-role-badge">{{ row.typeLabel }}</span>
                  </div>
                  <div class="entity-flags">
                    <span v-if="row.entity.is_deceased" class="dead-badge" title="Сущность мертва">💀</span>
                    <span
                      v-if="filters.highlightGaps && row.hasGapWarning"
                      class="matrix-gap-badge"
                      title="Провал в появлении: не упоминается 3+ глав подряд"
                    >
                      ⚠️
                    </span>
                  </div>
                </div>
              </td>

              <!-- Ячейки для каждой главы -->
              <td
                v-for="cell in row.cellList"
                :key="cell.chapterId"
                class="matrix-td matrix-cell"
                :class="[
                  `status-${cell.status}`,
                  {
                    'cell-death': cell.isDeceased,
                  },
                ]"
                :title="cell.label"
              >
                <div class="cell-badges-group">
                  <span v-if="cell.hasScene" class="cell-badge badge-scene" title="Сцена">🎬 {{ cell.count || 1 }}</span>
                  <span v-if="cell.hasMention" class="cell-badge badge-mention" title="Упоминание в тексте">💬</span>
                  <span v-if="cell.isDeceased" class="death-icon" title="Погиб">💀</span>
                  <span v-if="!cell.hasScene && !cell.hasMention && !cell.isDeceased" class="cell-badge badge-absent">—</span>
                </div>
              </td>

              <!-- Суммарная колонка справа -->
              <td class="matrix-td matrix-total-cell">
                <div class="matrix-total-group">
                  <span class="matrix-total-badge">{{ row.totalAppearances }}</span>
                  <div class="matrix-total-sub">
                    <span class="sub-scene" title="Сцен">🎬 {{ row.totalScenes }}</span>
                    <span class="sub-mention" title="Упоминаний">💬 {{ row.totalMentions }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>

          <!-- Tfoot: Суммарная статистика по главам -->
          <tfoot>
            <tr class="matrix-footer-row">
              <td class="matrix-td sticky-left matrix-footer-label">
                <span class="font-bold">Уникальных сущностей:</span>
              </td>
              <td
                v-for="col in chapterColumns"
                :key="`footer-${col.id}`"
                class="matrix-td matrix-footer-cell"
              >
                <span class="footer-count-badge">{{ col.uniqueEntities }}</span>
              </td>
              <td class="matrix-td matrix-total-cell matrix-footer-grand-total">
                <span class="footer-total-badge">{{ totalProjectAppearances }}</span>
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
  volumeGroups,
  rows,
  availableEntityTypes,
  volumeOptions,
  totalProjectAppearances,
  isLoading,
  refresh,
} = useCrossReferenceMatrix(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/CrossReferenceMatrix.css"></style>
