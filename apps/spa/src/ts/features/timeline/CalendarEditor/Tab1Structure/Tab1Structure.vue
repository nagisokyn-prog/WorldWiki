<template>
  <div class="tab1-structure">
    <!-- Секция: Месяцы года -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🗓️ Месяцы года</div>
          <div class="section-desc">Сумма дней: <strong class="status-chip">{{ totalYearDays }} дн.</strong></div>
        </div>
        <button v-if="!isReadOnly" type="button" class="btn-ghost-sm" @click="balanceMonthsEvenly">
          🪄 Выровнять поровну
        </button>
      </header>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Название</th>
            <th style="width: 140px;">Дней</th>
            <th style="width: 50px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(month, idx) in months" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>
              <input
                type="text"
                class="table-input"
                :value="month.название"
                :disabled="isReadOnly"
                @input="month.название = ($event.target as HTMLInputElement).value; updateMonths([...months])"
              />
            </td>
            <td>
              <input
                type="number"
                class="table-input"
                :value="month.дней"
                :disabled="isReadOnly"
                min="1"
                @input="month.дней = parseInt(($event.target as HTMLInputElement).value) || 1; updateMonths([...months])"
              />
            </td>
            <td>
              <button
                v-if="!isReadOnly && months.length > 1"
                type="button"
                class="btn-icon-table"
                title="Удалить месяц"
                @click="updateMonths(months.filter((_, i) => i !== idx))"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Секция: Дни недели -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">📅 Дни недели</div>
          <div class="section-desc">{{ weekdays.length }} дней в цикле недели.</div>
        </div>
      </header>

      <div class="chip-list">
        <span v-for="(wd, idx) in weekdays" :key="idx" class="preset-chip">
          {{ wd.название || `День ${idx + 1}` }}
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab1StructureProps, Tab1StructureEmits } from './Tab1Structure.model';
import { useTab1Structure } from './useTab1Structure';

const props = defineProps<Tab1StructureProps>();
const emit = defineEmits<Tab1StructureEmits>();

const {
  months,
  weekdays,
  totalYearDays,
  updateMonths,
  balanceMonthsEvenly,
} = useTab1Structure(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab1Structure.css"></style>
