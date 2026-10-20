<template>
  <div class="tab4-playground">
    <!-- СЕКЦИЯ 1: ТОЧКА ОТСЧЕТА ПРОИЗВЕДЕНИЯ (ДАТА НАЧАЛА СЮЖЕТА / 1-Й ГЛАВЫ) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title text-warning">
            🎯 Точка отсчёта произведения (Дата начала сюжета / 1-й главы)
          </div>
          <div class="section-desc">
            Истинный момент времени, с которого стартует повествование книги.
          </div>
        </div>
      </header>

      <div class="grid-4 mb-3">
        <div class="form-group">
          <label class="form-label">Год сюжета</label>
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
          <input
            v-model.number="storyOrigin.month"
            type="number"
            class="form-input"
            min="0"
            :disabled="isReadOnly"
            @input="updateOrigin({ month: storyOrigin.month })"
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

        <div class="form-group">
          <label class="form-label">Время (ч:м)</label>
          <div class="flex gap-1 items-center">
            <input
              v-model.number="storyOrigin.hour"
              type="number"
              class="form-input w-16"
              min="0"
              max="23"
              :disabled="isReadOnly"
              @input="updateOrigin({ hour: storyOrigin.hour })"
            /> :
            <input
              v-model.number="storyOrigin.minute"
              type="number"
              class="form-input w-16"
              min="0"
              max="59"
              :disabled="isReadOnly"
              @input="updateOrigin({ minute: storyOrigin.minute })"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- СЕКЦИЯ 2: ИНТЕРАКТИВНАЯ МАТРИЦА МЕСЯЦА -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">
            🗓️ Сетка месяца (Интерактивная матрица)
          </div>
          <div class="section-desc">Кликните на любой день для живой проверки параметров лора.</div>
        </div>
      </header>

      <div class="month-matrix-grid flex flex-wrap gap-2 mb-3">
        <div
          v-for="d in monthMatrixDays"
          :key="d.day"
          class="matrix-day-cell p-2 rounded border border-subtle cursor-pointer text-center w-14"
          :class="{
            'bg-accent text-white font-bold': d.isSelected,
            'bg-surface hover:bg-hover': !d.isSelected,
            'border-warning': d.isHoliday
          }"
          @click="selectMatrixDay(d.day)"
        >
          <div class="text-xs opacity-75">{{ d.weekdayName.slice(0, 2) }}</div>
          <div class="text-base">{{ d.day }}</div>
          <div v-if="d.isHoliday" class="text-xs">🎉</div>
        </div>
      </div>
    </section>

    <!-- СЕКЦИЯ 3: ЖИВОЙ ТЕСТЕР ДАТЫ -->
    <section class="section-card" v-if="liveCalculation">
      <header class="section-header">
        <div>
          <div class="section-title">🧪 Живой тестер параметров континуума</div>
          <div class="section-desc">
            Выбранная дата: <strong>{{ testDay }}.{{ testMonth + 1 }}.{{ testYear }}</strong>
          </div>
        </div>
      </header>

      <div class="grid-4">
        <div class="p-2 rounded bg-surface border border-subtle text-center">
          <span class="text-xs text-muted block mb-1">🌿 Сезон</span>
          <strong class="text-sm">{{ liveCalculation.seasonName }}</strong>
        </div>

        <div class="p-2 rounded bg-surface border border-subtle text-center">
          <span class="text-xs text-muted block mb-1">🎉 Праздник</span>
          <strong class="text-sm">{{ liveCalculation.isHoliday ? 'Да (Праздничный день)' : 'Будний день' }}</strong>
        </div>

        <div class="p-2 rounded bg-surface border border-subtle text-center">
          <span class="text-xs text-muted block mb-1">⚖️ Високосный год</span>
          <strong class="text-sm">{{ liveCalculation.isLeapYear ? 'Високосный' : 'Обычный' }}</strong>
        </div>

        <div class="p-2 rounded bg-surface border border-subtle text-center">
          <span class="text-xs text-muted block mb-1">⏱️ Мировой тик (M_abs)</span>
          <strong class="text-sm font-mono">{{ liveCalculation.absMinute }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab4PlaygroundProps, Tab4PlaygroundEmits } from './Tab4Playground.model';
import { useTab4Playground } from './useTab4Playground';

const props = defineProps<Tab4PlaygroundProps>();
const emit = defineEmits<Tab4PlaygroundEmits>();

const {
  storyOrigin,
  testYear,
  testMonth,
  testDay,
  liveCalculation,
  monthMatrixDays,
  updateOrigin,
  selectMatrixDay,
} = useTab4Playground(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarEditor.css"></style>
