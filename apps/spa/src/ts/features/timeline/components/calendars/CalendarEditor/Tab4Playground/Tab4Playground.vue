<template>
  <div class="tab4-playground">
    <!-- СЕКЦИЯ 1: ТОЧКА ОТСЧЕТА ПРОИЗВЕДЕНИЯ (ДАТА НАЧАЛА СЮЖЕТА / 1-Й ГЛАВЫ) -->
    <div class="section-card" style="border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.04);">
      <div class="section-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <input
            type="checkbox"
            checked
            style="accent-color: var(--accent-warning); width: 18px; height: 18px;"
            :disabled="isReadOnly"
          />
          <div>
            <div class="section-title" style="color: var(--accent-warning);">
              🎯 Точка отсчёта произведения (Дата начала сюжета / 1-й главы)
            </div>
            <div class="section-desc">
              Дата в этом календаре, с которой стартует повествование произведения.
            </div>
          </div>
        </div>
        <span class="status-chip warning">🌟 Активная точка отсчёта сюжета</span>
      </div>

      <div class="grid-4" style="margin-top: 12px;">
        <div class="form-group">
          <label class="form-label">Эпоха / Эра</label>
          <XboxWheel
            :model-value="storyOrigin.era_index"
            :options="eraWheelOptions"
            class="form-select"
            :class="{ 'pointer-events-none opacity-60': isReadOnly }"
            @update:model-value="storyOrigin.era_index = Number($event); updateOrigin({ era_index: storyOrigin.era_index })"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Год начала истории</label>
          <input
            v-model.number="storyOrigin.year"
            type="number"
            class="form-input"
            :disabled="isReadOnly"
            @input="updateOrigin({ year: storyOrigin.year })"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Месяц</label>
          <XboxWheel
            :model-value="storyOrigin.month"
            :options="monthWheelOptions"
            class="form-select"
            :class="{ 'pointer-events-none opacity-60': isReadOnly }"
            @update:model-value="storyOrigin.month = Number($event); updateOrigin({ month: storyOrigin.month })"
          />
        </div>

        <div class="form-group">
          <label class="form-label">День</label>
          <input
            v-model.number="storyOrigin.day"
            type="number"
            class="form-input"
            min="1"
            :disabled="isReadOnly"
            @input="updateOrigin({ day: storyOrigin.day })"
          />
        </div>
      </div>

      <div class="grid-2" style="margin-top: 8px;">
        <div class="form-group">
          <label class="form-label">День недели для даты старта истории</label>
          <XboxWheel
            :model-value="storyOrigin.weekday_index"
            :options="weekdayWheelOptions"
            class="form-select"
            :class="{ 'pointer-events-none opacity-60': isReadOnly }"
            @update:model-value="storyOrigin.weekday_index = Number($event); updateOrigin({ weekday_index: storyOrigin.weekday_index })"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Статус привязки к произведению</label>
          <div style="font-size: 12px; color: var(--text-muted); padding-top: 6px;">
            Этот календарь выбран как <strong>основной хронологический ориентир начала романа</strong>.
          </div>
        </div>
      </div>
    </div>

    <!-- СЕКЦИЯ 2: ИНТЕРАКТИВНАЯ МАТРИЦА МЕСЯЦА (7-КОЛОНОЧНЫЙ КАЛЕНДАРЬ) -->
    <Tab4MatrixSection
      :current-month-title="currentMonthTitle"
      :weekday-headers="weekdayHeaders"
      :month-matrix-days="monthMatrixDays"
      @prev-month="prevMonth"
      @next-month="nextMonth"
      @select-day="selectMatrixDay"
    />

    <!-- СЕКЦИЯ 3: ЖИВОЙ ТЕСТЕР ДАТЫ -->
    <div v-if="liveCalculation" class="section-card" style="margin-top: 12px;">
      <div class="section-header">
        <div>
          <div class="section-title">🧪 Проверка даты и событий дня</div>
          <div class="section-desc">
            Выбранная дата: <strong>{{ testDay }}.{{ testMonth + 1 }}.{{ testYear }}</strong>
          </div>
        </div>
      </div>

      <div class="astro-cards-grid">
        <div class="astro-card">
          <span class="astro-label">🌿 Сезон</span>
          <span class="astro-val">{{ liveCalculation.seasonName }}</span>
        </div>

        <div class="astro-card">
          <span class="astro-label">🎉 Праздник</span>
          <span class="astro-val">{{ liveCalculation.isHoliday ? 'Да (Праздничный день)' : 'Будний день' }}</span>
        </div>

        <div class="astro-card">
          <span class="astro-label">⚖️ Високосный год</span>
          <span class="astro-val">{{ liveCalculation.isLeapYear ? 'Високосный' : 'Обычный' }}</span>
        </div>

        <div class="astro-card">
          <span class="astro-label">⏱️ Шкала времени мира (минуты)</span>
          <span class="astro-val">{{ liveCalculation.absMinute }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { Tab4PlaygroundProps, Tab4PlaygroundEmits } from './Tab4Playground.model';
import { useTab4Playground } from './useTab4Playground';
import Tab4MatrixSection from './components/Tab4MatrixSection/Tab4MatrixSection.vue';

const props = defineProps<Tab4PlaygroundProps>();
const emit = defineEmits<Tab4PlaygroundEmits>();

const {
  storyOrigin,
  eraWheelOptions,
  monthWheelOptions,
  weekdayWheelOptions,
  testYear,
  testMonth,
  testDay,
  currentMonthTitle,
  weekdayHeaders,
  liveCalculation,
  monthMatrixDays,
  updateOrigin,
  selectMatrixDay,
  prevMonth,
  nextMonth,
} = useTab4Playground(props, emit);
</script>
