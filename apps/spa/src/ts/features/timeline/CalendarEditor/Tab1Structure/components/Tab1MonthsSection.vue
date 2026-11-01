<template>
  <section class="section-card">
    <header class="section-header">
      <div>
        <div class="section-title">🗓️ Месяцы года (Сетка базового года)</div>
        <div class="section-desc">
          Сумма дней во всех месяцах: <strong style="color: var(--accent-primary);">{{ totalYearDays }} дней</strong>.
        </div>
      </div>
      <div v-if="!isReadOnly" style="display: flex; gap: 8px;">
        <button type="button" class="btn-ghost-sm" @click="$emit('balance-months')">
          🪄 Выровнять поровну (по 30 дн.)
        </button>
        <button type="button" class="btn-ghost-sm" @click="$emit('add-month')">
          + Добавить месяц
        </button>
      </div>
    </header>

    <!-- Начало Нового Года (Пункт 14) -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 12px;">
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-main);">
        🎍 Начало Нового Года культуры (Точка новолетия)
      </div>
      <div class="grid-2 gap-3" style="align-items: center;">
        <div class="form-group">
          <label class="form-label">Месяц наступления Нового года</label>
          <XboxWheel
            :model-value="String(firstMonthOfYear ?? 0)"
            :options="monthOptions"
            @update:model-value="$emit('set-first-month', parseInt($event) || 0)"
          />
        </div>
        <div class="form-group">
          <label class="form-label">День месяца встречи Нового года</label>
          <input
            type="number"
            class="form-input"
            :value="newYearDay ?? 1"
            min="1"
            :max="maxDaysInSelectedMonth"
            :disabled="isReadOnly"
            style="width: 90px;"
            @input="$emit('set-new-year-day', parseInt(($event.target as HTMLInputElement).value) || 1)"
          />
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Название месяца</th>
          <th style="width: 140px;">Дней в месяце</th>
          <th style="width: 140px;">Сезон</th>
          <th style="width: 50px;"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(month, idx) in months" :key="idx">
          <td style="color: var(--text-dim);">{{ idx + 1 }}</td>
          <td>
            <input
              v-model="month.название"
              type="text"
              class="table-input"
              :disabled="isReadOnly"
              @input="$emit('update-months', [...months])"
            />
          </td>
          <td>
            <input
              v-model.number="month.дней"
              type="number"
              class="table-input"
              min="1"
              :disabled="isReadOnly"
              @input="$emit('update-months', [...months])"
            />
          </td>
          <td>
            <span class="status-chip" style="font-size: 11px;">
              {{ seasonLabels[idx] }}
            </span>
          </td>
          <td>
            <button
              v-if="!isReadOnly && months.length > 1"
              type="button"
              class="btn-icon-table"
              title="Удалить месяц"
              @click="$emit('update-months', months.filter((_, i) => i !== idx))"
            >
              🗑️
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { XboxWheel } from '@worldwiki/components';
import type { Tab1MonthsSectionProps, Tab1MonthsSectionEmits } from './Tab1MonthsSection.model';
import { useTab1MonthsSection } from './useTab1MonthsSection';

const props = defineProps<Tab1MonthsSectionProps>();

defineEmits<Tab1MonthsSectionEmits>();

const { seasonLabels } = useTab1MonthsSection(props);

const monthOptions = computed(() =>
  props.months.map((m, idx) => ({
    value: String(idx),
    label: `${idx + 1}. ${m.название || `Месяц ${idx + 1}`}`,
  }))
);

const maxDaysInSelectedMonth = computed(() => {
  const selected = props.months[props.firstMonthOfYear ?? 0];
  return selected ? Number(selected.дней) || 31 : 31;
});
</script>
