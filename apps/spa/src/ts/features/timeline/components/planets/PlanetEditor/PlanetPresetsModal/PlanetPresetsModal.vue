<template>
  <div v-if="modelValue" class="modal-backdrop" @click.self="close">
    <div class="planet-presets-dialog" role="dialog" aria-modal="true" aria-labelledby="planet-presets-title">
      <!-- Шапка -->
      <div class="presets-header">
        <div class="presets-header-title">
          <span class="presets-header-icon">🪐</span>
          <div>
            <h3 id="planet-presets-title" class="presets-main-title">Библиотека пресетов планет</h3>
            <p class="presets-subtitle">Выберите готовую астрофизическую модель: от Земли и Марса до Венеры и мира трёх лун</p>
          </div>
        </div>
        <button type="button" class="btn-close" aria-label="Закрыть" @click="close">✕</button>
      </div>

      <!-- Фильтры и поиск -->
      <div class="presets-controls-row">
        <div class="presets-tags-row">
          <button
            v-for="tag in availableTags"
            :key="tag"
            type="button"
            class="tag-btn"
            :class="{ active: activeTag === tag }"
            @click="selectTag(tag)"
          >
            {{ tag === 'all' ? 'Все модели' : tag }}
          </button>
        </div>

        <div class="presets-search-box">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Поиск по названию или описанию..."
          />
        </div>
      </div>

      <!-- Сетка пресетов -->
      <div class="presets-body">
        <div v-if="filteredPresets.length === 0" class="presets-empty">
          🔍 Модели не найдены. Попробуйте изменить поисковый запрос.
        </div>

        <div v-else class="presets-grid">
          <div
            v-for="preset in filteredPresets"
            :key="preset.id"
            class="planet-preset-card"
          >
            <div class="preset-card-top">
              <span class="preset-icon">{{ preset.icon }}</span>
              <div class="preset-info">
                <div class="preset-title-line">
                  <h4 class="preset-name">{{ preset.name }}</h4>
                  <span class="tag-badge">{{ preset.tag }}</span>
                </div>
              </div>
            </div>

            <p class="preset-desc">{{ preset.description }}</p>

            <div class="preset-stats">
              <span class="stat-pill" title="Продолжительность суток">
                ⏰ Сутки: {{ preset.dayHours }}ч {{ preset.dayMinutes }}м
              </span>
              <span class="stat-pill" title="Орбитальный период (год)">
                📅 Год: {{ preset.orbitDays }} сут.
              </span>
              <span class="stat-pill" title="Наклон оси вращения">
                📐 Наклон: {{ preset.axialTilt }}°
              </span>
              <span class="stat-pill" :class="{ warning: preset.rotationDirection === 'retrograde' }">
                🔄 {{ preset.rotationDirection === 'retrograde' ? 'Ретроградное (восход на западе)' : 'Прямое вращение' }}
              </span>
              <span v-if="preset.data.moons && preset.data.moons.length > 0" class="stat-pill">
                🌕 Спутников: {{ preset.data.moons.length }}
              </span>
            </div>

            <div class="preset-actions">
              <button
                type="button"
                class="btn-apply"
                @click="promptApplyPreset(preset)"
              >
                ✨ Применить пресет
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Подтверждение перезаписи -->
      <div v-if="confirmApplyVisible && selectedPreset" class="confirm-overlay">
        <div class="confirm-box">
          <h4 class="confirm-title">Применить пресет «{{ selectedPreset.name }}»?</h4>
          <p class="confirm-text">
            Все текущие астрофизические параметры планеты (сутки, год, наклон оси, направление вращения, луны и часовые пояса) будут заменены на параметры выбранного пресета.
          </p>
          <div class="confirm-actions">
            <button type="button" class="btn-cancel" @click="cancelApply">Отмена</button>
            <button type="button" class="btn-confirm" @click="confirmApply">Да, применить</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanetPresetsModalProps, PlanetPresetsModalEmits } from './PlanetPresetsModal.model';
import { usePlanetPresetsModal } from './usePlanetPresetsModal';

const props = defineProps<PlanetPresetsModalProps>();
const emit = defineEmits<PlanetPresetsModalEmits>();

const {
  searchQuery,
  activeTag,
  availableTags,
  selectedPreset,
  confirmApplyVisible,
  filteredPresets,
  selectTag,
  promptApplyPreset,
  confirmApply,
  cancelApply,
  close,
} = usePlanetPresetsModal(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/timeline/PlanetPresetsModal.css"></style>
