<template>
  <section class="section-card">
    <header class="section-header">
      <div>
        <div class="section-title">⏰ Деление суток (Часы, стражи, минуты)</div>
        <div class="section-desc">
          Произвольная цепочка делений дня от старшей к младшей (часы, стражи, минуты, удары гонга).
        </div>
      </div>
    </header>

    <!-- Пресеты циферблатов -->
    <div class="form-group mb-3">
      <label class="form-label">Готовые пресеты циферблатов культур</label>
      <div class="chip-list">
        <button
          type="button"
          class="preset-chip"
          :disabled="isReadOnly"
          @click="$emit('apply-preset', 'earth')"
        >
          🌍 Земной стандарт (24ч × 60м × 60с)
        </button>
        <button
          type="button"
          class="preset-chip"
          :disabled="isReadOnly"
          @click="$emit('apply-preset', 'fantasy')"
        >
          🏰 Фэнтези: Стражи и Колокола (4 × 6 × 100)
        </button>
        <button
          type="button"
          class="preset-chip"
          :disabled="isReadOnly"
          @click="$emit('apply-preset', 'metric')"
        >
          📐 Десятичный (10 × 100 × 100)
        </button>
        <button
          type="button"
          class="preset-chip"
          :disabled="isReadOnly"
          @click="$emit('apply-preset', 'agrarian')"
        >
          🌾 Аграрный (без часов, только сутки)
        </button>
      </div>
    </div>

    <!-- Таблица единиц времени -->
    <table class="items-table mb-3">
      <thead>
        <tr>
          <th class="w-10">#</th>
          <th>Название единицы времени</th>
          <th class="w-48">Делений в родительской единице</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(unit, idx) in dialUnits" :key="idx">
          <td>{{ idx + 1 }}</td>
          <td>
            <input
              v-model="unit.name"
              type="text"
              class="table-input"
              :disabled="isReadOnly"
            />
          </td>
          <td>
            <input
              v-model.number="unit.subdivisions"
              type="number"
              class="table-input"
              min="1"
              :disabled="isReadOnly"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Момент смены суток -->
    <div class="form-group">
      <label class="form-label">Момент смены суток (day_start_offset)</label>
      <select
        :value="dayStartOffset"
        class="form-select max-w-sm"
        :disabled="isReadOnly"
        @change="$emit('set-day-start-offset', ($event.target as HTMLSelectElement).value as DayStartMode)"
      >
        <option value="midnight">Полночь (00:00, 0 тиков — стандарт)</option>
        <option value="sunrise">Рассвет (+0.25 от суток — Египет, Эфиопия)</option>
        <option value="noon">Полдень (+0.50 от суток — счет JDN)</option>
        <option value="sunset">Закат (-0.25 от суток — древнесемитский, ислам)</option>
        <option value="custom">⚙️ Кастомное время / смещение</option>
      </select>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DialUnit } from '@/services/Calendars/calendar.types';
import type { DialPreset, DayStartMode } from '../Tab1Structure.model';

defineProps<{
  dialUnits: DialUnit[];
  dayStartOffset: string;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'apply-preset', preset: DialPreset): void;
  (e: 'set-day-start-offset', mode: DayStartMode): void;
}>();
</script>
