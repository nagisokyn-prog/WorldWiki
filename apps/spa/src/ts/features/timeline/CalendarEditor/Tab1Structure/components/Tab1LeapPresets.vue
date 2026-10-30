<template>
  <div>
    <!-- Быстрые пресеты известных систем -->
    <div class="form-group" style="margin-bottom: 12px;">
      <label class="form-label">Быстрые пресеты известных систем</label>
      <div class="chip-list">
        <button
          type="button"
          class="preset-chip"
          :class="{ active: activeSystemPreset === 'gregorian' }"
          :disabled="isReadOnly"
          @click="$emit('select-system-preset', 'gregorian')"
        >
          🌍 Григорианский (Земля)
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: activeSystemPreset === 'tolkien' }"
          :disabled="isReadOnly"
          @click="$emit('select-system-preset', 'tolkien')"
        >
          🧙 Шир Толкина (12×30 + 5 Лите)
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: activeSystemPreset === 'egyptian' }"
          :disabled="isReadOnly"
          @click="$emit('select-system-preset', 'egyptian')"
        >
          🏛️ Древнеегипетский (12×30 + 5 эпагоменов)
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: activeSystemPreset === 'custom' }"
          :disabled="isReadOnly"
          @click="$emit('select-system-preset', 'custom')"
        >
          ⚙️ Своё правило (+3 каждые 10/20/200 лет)
        </button>
      </div>
    </div>

    <!-- Выбор режима високосного правила -->
    <div class="form-group">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label class="form-label" style="margin: 0;">Режим високосного правила</label>
        <button
          type="button"
          class="suggest-trigger-btn"
          @click="$emit('toggle-suggestions')"
        >
          🎯 Подобрать правило под планету ({{ orbitDays.toFixed(4) }} сут.)
        </button>
      </div>

      <div class="chip-list">
        <button
          type="button"
          class="preset-chip"
          :class="{ active: ruleType === 'gregorian' }"
          :disabled="isReadOnly"
          @click="$emit('select-rule-type', 'gregorian')"
        >
          Григорианское (каждые 4 года, кроме 100, плюс 400)
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: ruleType === 'simple' }"
          :disabled="isReadOnly"
          @click="$emit('select-rule-type', 'simple')"
        >
          Простое (каждый 4-й год)
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: ruleType === 'custom' }"
          :disabled="isReadOnly"
          @click="$emit('select-rule-type', 'custom')"
        >
          Пользовательский конструктор (свои условия)
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: ruleType === 'none' }"
          :disabled="isReadOnly"
          @click="$emit('select-rule-type', 'none')"
        >
          Отсутствует (строго постоянный год)
        </button>
      </div>

      <!-- Выпадающий блок автоматического подбора под орбиту (Цепные дроби Rust WASM) -->
      <div v-if="showSuggestions" class="suggestions-panel">
        <div class="suggestions-header">
          <span>🎯 Оптимальные варианты для орбиты планеты {{ orbitDays.toFixed(4) }} сут.:</span>
          <button type="button" class="btn-ghost-sm" @click="$emit('toggle-suggestions')">✕</button>
        </div>
        <div class="suggestions-list">
          <div
            v-for="s in suggestions"
            :key="s.key"
            class="suggestion-card"
            @click="$emit('apply-suggestion', s.key)"
          >
            <div class="suggestion-main">
              <span class="suggestion-ratio">{{ s.ratio }}</span>
              <span class="suggestion-desc">{{ s.desc }}</span>
            </div>
            <div class="suggestion-meta">
              <span class="suggestion-drift drift-badge" :class="s.isOk ? 'drift-ok' : 'drift-warning'">
                {{ s.drift }}
              </span>
              <button type="button" class="suggestion-apply-btn">Применить</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab1LeapPresetsProps, Tab1LeapPresetsEmits } from './Tab1LeapPresets.model';

defineProps<Tab1LeapPresetsProps>();

defineEmits<Tab1LeapPresetsEmits>();
</script>
