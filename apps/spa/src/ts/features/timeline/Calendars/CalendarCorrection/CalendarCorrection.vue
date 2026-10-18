<template>
  <div class="calendar-section calendar-correction-card">
    <div class="correction-header" @click="isCollapsed = !isCollapsed">
      <div class="correction-header-title">
        <h4>📅 Календарная коррекция и праздники</h4>
        <span v-if="baseExtraDays > 0" class="badge-count">+{{ baseExtraDays }} дн.</span>
      </div>
      <div class="correction-header-meta">
        <span
          class="drift-badge"
          :class="{ 'drift-warning': Math.abs(driftPerCentury) > 1.0, 'drift-ok': Math.abs(driftPerCentury) <= 1.0 }"
          :title="'Вековой дрейф календаря относительно орбиты планеты'"
        >
          {{ driftPerCentury >= 0 ? '+' : '' }}{{ driftPerCentury.toFixed(2) }} сут/век
        </span>
        <span class="correction-collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
      </div>
    </div>

    <div v-if="!isCollapsed" class="correction-content">
      <div v-if="driftWarning" class="drift-warning-banner">
        <div>⚠️ {{ driftWarning }}</div>
        <div v-if="baseExtraDays > 0 && totalBaseYearDays !== Math.floor(targetOrbitalDays)" class="drift-warning-actions">
          <button
            type="button"
            class="drift-action-btn interactive-el"
            @click="balanceMonthsForExtraDays"
          >
            🪄 Сбалансировать месяцы ({{ Math.floor(targetOrbitalDays) - baseExtraDays }} дн. в месяцах + {{ baseExtraDays }} праздничных = {{ Math.floor(targetOrbitalDays) }} дн.)
          </button>
          <button
            type="button"
            class="drift-action-btn interactive-el"
            @click="resetExtraDays"
          >
            Сбросить праздничные дни в 0
          </button>
        </div>
      </div>

      <!-- Быстрые пресеты -->
      <div class="calendar-field">
        <label class="glass-label">Быстрые пресеты известных систем</label>
        <div class="correction-presets">
          <button type="button" class="preset-chip" @click="applyPreset('gregorian')">
            🌍 Григорианский (Земля)
          </button>
          <button type="button" class="preset-chip" @click="applyPreset('tolkien')">
            🧙 Шир Толкина (Лите)
          </button>
          <button type="button" class="preset-chip" @click="applyPreset('egyptian')">
            🏛️ Древнеегипетский
          </button>
          <button type="button" class="preset-chip" @click="applyPreset('custom_example')">
            ⚙️ Кастом (+3 каждые 10/20/200 лет)
          </button>
        </div>
      </div>

      <!-- Выбор правила -->
      <div class="calendar-field">
        <div class="flex items-center justify-between mb-1">
          <label class="glass-label m-0">Режим високосного правила</label>
          <button
            type="button"
            class="suggest-trigger-btn interactive-el"
            :title="`Автоматический подбор правила под орбиту планеты (${targetOrbitalDays.toFixed(2)} сут.)`"
            @click="toggleSuggestions"
          >
            🎯 Подобрать правило под планету
          </button>
        </div>
        <XboxWheel
          v-model="ruleType"
          :options="[
            { value: 'григорианское', label: 'Григорианское (каждые 4 года, кроме 100, плюс 400)' },
            { value: 'каждый 4 год', label: 'Простое (каждый 4-й год)' },
            { value: 'пользовательское', label: 'Пользовательский конструктор (кастомные гармоники)' },
            { value: 'отсутствует', label: 'Отсутствует (строго постоянный год)' },
          ]"
        />

        <!-- Выпадающий блок подбора (цеzero-дрейф цепные дроби) -->
        <div v-if="isSuggestOpen" class="suggestions-panel">
          <div class="suggestions-header">
            <span>🎯 Оптимальные варианты для орбиты {{ targetOrbitalDays.toFixed(4) }} сут.:</span>
            <button type="button" class="close-suggest-btn" @click="isSuggestOpen = false">✕</button>
          </div>
          <div v-if="leapSuggestions.length === 0" class="text-xs text-muted p-2">
            Год календаря точно совпадает с орбитой планеты (високосы не требуются).
          </div>
          <div v-else class="suggestions-list">
            <div
              v-for="(s, sIdx) in leapSuggestions"
              :key="sIdx"
              class="suggestion-card interactive-el"
              @click="applySuggestion(s)"
            >
              <div class="suggestion-main">
                <span class="suggestion-ratio">{{ s.label }}</span>
                <span class="suggestion-desc">{{ s.description }}</span>
              </div>
              <div class="suggestion-meta">
                <span
                  class="suggestion-drift"
                  :class="{ 'drift-ok': Math.abs(s.driftPerCentury) <= 0.1, 'drift-warning': Math.abs(s.driftPerCentury) > 0.1 }"
                >
                  Дрейф: {{ s.driftPerCentury >= 0 ? '+' : '' }}{{ s.driftPerCentury.toFixed(3) }} сут/век
                </span>
                <button type="button" class="suggestion-apply-btn">Применить</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Блок 1: Дни вне месяцев (Ежегодные праздники) -->
      <div class="correction-subcard">
        <div class="correction-subcard-title">
          <span>✨ Дни вне месяцев (Ежегодные праздники)</span>
          <span class="text-xs text-muted">{{ baseExtraDays }} сут. в обычный год</span>
        </div>
        <div class="grid-2 gap-3">
          <div class="calendar-field">
            <label class="glass-label">Дней вне месяцев</label>
            <input v-model.number="baseExtraDays" type="number" min="0" class="interactive-el" />
          </div>
          <div class="calendar-field">
            <label class="glass-label">Название блока</label>
            <input
              v-model="extraDaysName"
              type="text"
              class="interactive-el"
              placeholder="Праздники середины года / Йул"
            />
          </div>
        </div>

        <div v-if="baseExtraDays > 0" class="grid-2 gap-3 mt-1">
          <div class="calendar-field">
            <label class="glass-label">Позиция в структуре года</label>
            <XboxWheel
              v-model="placement"
              :options="[
                { value: 'end_of_year', label: 'В конце года (после всех месяцев)' },
                { value: 'mid_year', label: 'В середине года (как у Толкина)' },
                { value: 'start_of_year', label: 'В начале года (перед 1-м месяцем)' },
                { value: 'after_month', label: 'После конкретного месяца...' },
              ]"
            />
          </div>
          <div v-if="placement === 'after_month'" class="calendar-field">
            <label class="glass-label">После какого месяца</label>
            <XboxWheel
              v-model.number="afterMonthIndex"
              :options="
                (modelValue.месяцы || []).map((m: { название: string }, idx: number) => ({
                  value: idx,
                  label: m.название,
                }))
              "
            />
          </div>
        </div>

        <label class="glass-checkbox-label">
          <input v-model="pauseWeekdays" type="checkbox" class="interactive-el" />
          <span>⏸️ Замораживать счет дней недели на время праздников</span>
        </label>

        <!-- Наглядная лента структуры года -->
        <div class="year-tape-container">
          <div class="year-tape-title">🗓️ Лента структуры года (последовательность месяцев и праздников):</div>
          <div class="year-tape-scroll">
            <div
              v-for="item in yearTimeline"
              :key="item.id"
              class="tape-item"
              :class="{
                'tape-extra-days': item.type === 'extra_days',
                'tape-month': item.type === 'month',
                'tape-leap-target': item.isLeapTarget,
              }"
              :title="item.type === 'extra_days' ? 'Праздничный блок вне месяцев' : `Месяц: ${item.name}`"
            >
              <span class="tape-item-name">{{ item.name }}</span>
              <span class="tape-item-days">
                {{ item.days }} дн.
                <small v-if="item.leapDaysAdded && item.leapDaysAdded > 0" class="tape-leap-badge">
                  +{{ item.leapDaysAdded }}
                </small>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Блок 2: Високосная надбавка и куда начислять -->
      <div v-if="ruleType !== 'отсутствует'" class="correction-subcard">
        <div class="correction-subcard-title">
          <span>⚡ Високосная надбавка</span>
        </div>
        <div class="grid-2 gap-3">
          <div class="calendar-field">
            <label class="glass-label">Добавлять дней в високосный год</label>
            <input v-model.number="leapDaysOffset" type="number" min="1" class="interactive-el" />
          </div>
          <div class="calendar-field">
            <label class="glass-label">Куда начислять добавку</label>
            <div class="target-radio-group">
              <label class="target-radio-label">
                <input
                  v-model="targetMode"
                  type="radio"
                  value="in_month"
                  class="interactive-el"
                />
                <span>В конкретный месяц</span>
              </label>
              <label class="target-radio-label">
                <input
                  v-model="targetMode"
                  type="radio"
                  value="in_extra_days"
                  class="interactive-el"
                />
                <span>В праздничные дни вне месяцев</span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="targetMode === 'in_month'" class="calendar-field mt-2">
          <div class="flex items-center justify-between mb-1">
            <label class="glass-label m-0">Целевой месяц</label>
            <span v-if="modelValue.месяцы?.[targetMonthIndex]" class="text-xs text-muted">
              {{ modelValue.месяцы[targetMonthIndex].название }}: {{ modelValue.месяцы[targetMonthIndex].дней + leapDaysOffset }} дн. вместо {{ modelValue.месяцы[targetMonthIndex].дней }} дн. (+{{ leapDaysOffset }} дн.)
            </span>
          </div>
          <XboxWheel
            v-model.number="targetMonthIndex"
            :options="
              (modelValue.месяцы || []).map((m: { название: string; дней: number }, idx: number) => ({
                value: idx,
                label: `${m.название} (${m.дней} дн.)`,
              }))
            "
          />
        </div>
      </div>

      <!-- Блок 3: Конструктор гармоник (если пользовательский режим) -->
      <div v-if="ruleType === 'пользовательское'" class="correction-subcard">
        <div class="correction-subcard-title">
          <span>🎛️ Правила цикла (Гармоники делимости)</span>
          <span
            class="drift-badge"
            :class="{ 'drift-ok': Math.abs(driftPerCentury) <= 0.1, 'drift-warning': Math.abs(driftPerCentury) > 0.1 }"
          >
            Дрейф: {{ driftPerCentury >= 0 ? '+' : '' }}{{ driftPerCentury.toFixed(3) }} сут/век
          </span>
        </div>
        <p class="text-xs text-muted m-0">
          Задайте условия наступления високоса: добавления (+) и исключения (-).
        </p>
        <div class="harmonics-list">
          <div
            v-for="(h, idx) in modelValue.високосные_правила || []"
            :key="idx"
            class="harmonic-item"
          >
            <span
              class="harmonic-sign"
              :class="{ positive: h.weight > 0, negative: h.weight < 0 }"
            >
              {{ h.weight > 0 ? '+' : '-' }}
            </span>
            <span class="text-xs">
              {{ h.weight > 0 ? 'Добавлять каждые' : 'КРОМЕ кратных' }}
            </span>
            <input
              type="number"
              min="1"
              :value="h.divisor_c"
              class="harmonic-period-input interactive-el"
              @input="updateHarmonicDivisor(idx, Number(($event.target as HTMLInputElement).value))"
            />
            <span class="text-xs text-muted">лет</span>
            <button
              type="button"
              class="harmonic-delete-btn"
              title="Удалить условие"
              @click="removeHarmonic(idx)"
            >
              ✕
            </button>
          </div>
        </div>
        <div class="add-harmonic-row">
          <button type="button" class="add-harmonic-btn" @click="addHarmonic(1, 4)">
            + Добавить условие (+)
          </button>
          <button type="button" class="add-harmonic-btn" @click="addHarmonic(-1, 100)">
            - Добавить исключение (-)
          </button>
        </div>
      </div>

      <!-- Блок 4: Инспектор и живая проверка -->
      <div class="correction-subcard">
        <div class="correction-subcard-title">
          <span>🔍 Инспектор и живая проверка</span>
          <span class="text-xs text-muted">Базовый год: {{ totalBaseYearDays }} сут.</span>
        </div>
        <div class="upcoming-years-row">
          <span
            v-for="item in sampleUpcomingYears"
            :key="item.year"
            class="upcoming-year-pill"
            :class="{ 'is-leap': item.isLeap }"
          >
            {{ item.year }} г.: {{ item.isLeap ? `Високосный (+${item.daysAdded} дн.)` : 'Обычный' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useCalendarCorrection } from './useCalendarCorrection';
import type { CalendarCorrectionProps, CalendarCorrectionEmits } from './CalendarCorrection.model';

const props = defineProps<CalendarCorrectionProps>();
const emit = defineEmits<CalendarCorrectionEmits>();

const {
  isCollapsed,
  ruleType,
  baseExtraDays,
  extraDaysName,
  pauseWeekdays,
  placement,
  afterMonthIndex,
  yearTimeline,
  targetMode,
  targetMonthIndex,
  leapDaysOffset,
  totalBaseYearDays,
  driftPerCentury,
  driftWarning,
  targetOrbitalDays,
  isSuggestOpen,
  leapSuggestions,
  toggleSuggestions,
  applySuggestion,
  sampleUpcomingYears,
  addHarmonic,
  removeHarmonic,
  updateHarmonicDivisor,
  applyPreset,
  balanceMonthsForExtraDays,
  resetExtraDays,
} = useCalendarCorrection(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarCorrection.css"></style>
