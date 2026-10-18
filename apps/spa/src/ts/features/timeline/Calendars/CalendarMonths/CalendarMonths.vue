<template>
  <div class="calendar-section calendar-months-card">
    <div class="months-section-header" @click="isCollapsed = !isCollapsed">
      <div class="months-header-title">
        <h4>📆 Месяцы</h4>
        <span class="months-sum-badge" :class="daysBalanceClass">
          {{ daysBalanceText }}
        </span>
      </div>
      <span class="months-collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-if="!isCollapsed" class="months-content">
      <div class="item-list">
        <div v-for="(month, mIdx) in modelValue.месяцы" :key="mIdx" class="item-row">
          <input v-model="month.название" type="text" class="item-name interactive-el month-name-input" placeholder="Название" />
          <input
            v-model.number="month.дней"
            type="number"
            min="1"
            max="100"
            class="item-duration interactive-el month-days-input"
            title="Дней в месяце"
          />
          <div class="item-actions">
            <button
              type="button"
              class="btn-icon interactive-el"
              :disabled="Number(mIdx) === 0"
              @click.prevent="moveItem(Number(mIdx), -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn-icon interactive-el"
              :disabled="Number(mIdx) === (modelValue.месяцы?.length || 0) - 1"
              @click.prevent="moveItem(Number(mIdx), 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="btn-icon interactive-el"
              @click.prevent="removeMonth(Number(mIdx))"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
      <button type="button" class="btn-add interactive-el" @click.prevent="addMonth">➕ Добавить месяц</button>

      <div v-if="modelValue.месяцы && modelValue.месяцы.length > 0" class="calendar-field mt-3">
        <label class="text-xs text-muted block mb-1">Месяц начала года (Новогодний стиль)</label>
        <select
          :value="modelValue.первый_месяц_года || 0"
          class="interactive-el glass-select w-full"
          @change="updateFirstMonth(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="(m, idx) in modelValue.месяцы" :key="idx" :value="idx">
            {{ m.название }} (стиль {{ idx + 1 }}-го месяца)
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarMonths } from './useCalendarMonths';
import type { CalendarMonthsProps } from './useCalendarMonths';

const props = defineProps<CalendarMonthsProps>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: unknown): void;
}>();

const { isCollapsed, moveItem, addMonth, removeMonth, daysBalanceText, daysBalanceClass, updateFirstMonth } = useCalendarMonths(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarMonths.css"></style>

