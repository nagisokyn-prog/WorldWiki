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
import type { Tab1MonthsSectionProps, Tab1MonthsSectionEmits } from './Tab1MonthsSection.model';
import { useTab1MonthsSection } from './useTab1MonthsSection';

const props = defineProps<Tab1MonthsSectionProps>();

defineEmits<Tab1MonthsSectionEmits>();

const { seasonLabels } = useTab1MonthsSection(props);
</script>
