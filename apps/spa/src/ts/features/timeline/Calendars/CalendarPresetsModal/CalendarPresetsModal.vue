<template>
  <div v-if="modelValue" class="modal-backdrop" @click.self="close">
    <div class="modal-dialog presets-dialog glass-card">
      <div class="glass-card-bg"></div>
      <div class="glass-card-content presets-modal-inner">
        <!-- Шапка -->
        <div class="modal-header presets-header">
          <div class="presets-header-title">
            <span class="presets-header-icon">✨</span>
            <div>
              <h3 class="m-0 text-heading">Библиотека пресетов календаря</h3>
              <p class="presets-subtitle">Выберите готовую систему времени реального мира или фэнтези-вселенных</p>
            </div>
          </div>
          <button type="button" class="btn-close interactive-el" @click="close">✕</button>
        </div>

        <!-- Фильтры и поиск -->
        <div class="presets-controls-row">
          <div class="presets-category-pills">
            <button
              type="button"
              class="pill-btn interactive-el"
              :class="{ active: activeCategory === 'all' }"
              @click="selectCategory('all')"
            >
              Все пресеты
            </button>
            <button
              type="button"
              class="pill-btn interactive-el"
              :class="{ active: activeCategory === 'real_world' }"
              @click="selectCategory('real_world')"
            >
              🌍 Реальный мир
            </button>
            <button
              type="button"
              class="pill-btn interactive-el"
              :class="{ active: activeCategory === 'fantasy' }"
              @click="selectCategory('fantasy')"
            >
              🧙 Фэнтези
            </button>
          </div>

          <div class="presets-search-box">
            <input
              v-model="searchQuery"
              type="text"
              class="glass-input presets-search-input"
              placeholder="Поиск по названию или автору..."
            />
          </div>
        </div>

        <!-- Список пресетов -->
        <div class="modal-body presets-body">
          <div v-if="filteredPresets.length === 0" class="presets-empty text-center text-muted">
            🔍 Пресеты не найдены. Попробуйте изменить поисковый запрос.
          </div>

          <div v-else class="presets-grid">
            <div
              v-for="preset in filteredPresets"
              :key="preset.id"
              class="preset-card glass-panel"
            >
              <div class="preset-card-top">
                <span class="preset-icon">{{ preset.icon }}</span>
                <div class="preset-meta-info">
                  <div class="preset-title-row">
                    <h4 class="preset-name">{{ preset.name }}</h4>
                    <span class="preset-badge" :class="preset.category">{{ preset.categoryLabel }}</span>
                  </div>
                  <span class="preset-author text-muted text-xs">{{ preset.authorOrLore }}</span>
                </div>
              </div>

              <p class="preset-desc">{{ preset.description }}</p>

              <div class="preset-stats-chips">
                <span class="stat-chip" title="Дней в году">📅 {{ preset.totalDays }} дн.</span>
                <span class="stat-chip" title="Месяцев">🌕 {{ preset.monthsCount }} мес.</span>
                <span class="stat-chip" title="Дней в неделе">🗓️ {{ preset.weekDaysCount }} дн/нед</span>
                <span class="stat-chip" title="Праздников">🎉 {{ preset.holidaysCount }} праздн.</span>
              </div>

              <div class="preset-card-actions">
                <button
                  type="button"
                  class="glass-btn primary sm w-full interactive-el"
                  @click="promptApplyPreset(preset)"
                >
                  ✨ Применить пресет
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Подтверждение применения -->
        <div v-if="confirmApplyVisible" class="preset-confirm-overlay">
          <div class="preset-confirm-dialog glass-panel">
            <h4>⚠️ Применить пресет «{{ selectedPreset?.name }}»?</h4>
            <p>
              Все текущие месяцы, дни недели, праздники и сезоны будут заменены настройками выбранного пресета.
              Несохранённые изменения текущего календаря будут перезаписаны.
            </p>
            <div class="preset-confirm-actions">
              <button type="button" class="glass-btn outline sm interactive-el" @click="cancelApply">
                Отмена
              </button>
              <button type="button" class="glass-btn primary sm interactive-el" @click="confirmApply">
                Да, применить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarPresetsModalProps, CalendarPresetsModalEmits } from './CalendarPresetsModal.model';
import { useCalendarPresetsModal } from './useCalendarPresetsModal';

const props = defineProps<CalendarPresetsModalProps>();
const emit = defineEmits<CalendarPresetsModalEmits>();

const {
  searchQuery,
  activeCategory,
  selectedPreset,
  confirmApplyVisible,
  filteredPresets,
  selectCategory,
  promptApplyPreset,
  confirmApply,
  cancelApply,
  close,
} = useCalendarPresetsModal(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/timeline/CalendarPresetsModal.css"></style>
