<template>
  <div class="calendar-section">
    <div class="section-header holidays-section-header" @click="isCollapsed = !isCollapsed">
      <h4 class="m-0">🎉 Праздники</h4>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-if="!isCollapsed" class="mt-3">
      <div class="item-list">
        <div v-for="(holiday, hIdx) in modelValue.праздники" :key="hIdx" class="item-row holiday-row-wrap">
          <input
            v-model="holiday.название"
            type="text"
            class="item-name holiday-name-input interactive-el"
            placeholder="Название праздника"
          />
          <div class="holiday-dates-wrap">
            <XboxWheel
              v-model.number="holiday.дата_начала.месяц"
              :horizontal="wheelHorizontal"
              :options="
                (modelValue.месяцы || []).map((m: any, mi: number) => ({
                  value: mi,
                  label: m.название,
                }))
              "
              class="holiday-wheel-select"
            >
            </XboxWheel>
            <input
              v-model.number="holiday.дата_начала.день"
              type="number"
              min="1"
              :max="
                getDaysInMonth(
                  modelValue,
                  modelValue.эпохи?.[0]?.год_начала || 1,
                  holiday.дата_начала.месяц,
                )
              "
              class="holiday-day-input interactive-el"
            />
            <span v-if="holiday.дата_конца">—</span>
            <XboxWheel
              v-if="holiday.дата_конца"
              v-model.number="holiday.дата_конца.месяц"
              :horizontal="wheelHorizontal"
              :options="
                (modelValue.месяцы || []).map((m: any, mi: number) => ({
                  value: mi,
                  label: m.название,
                }))
              "
              class="holiday-wheel-select"
            >
            </XboxWheel>
            <input
              v-if="holiday.дата_конца"
              v-model.number="holiday.дата_конца.день"
              type="number"
              min="1"
              :max="
                getDaysInMonth(
                  modelValue,
                  modelValue.эпохи?.[0]?.год_начала || 1,
                  holiday.дата_конца.месяц,
                )
              "
              class="holiday-day-input interactive-el"
            />
            <button
              type="button"
              class="btn-icon interactive-el holiday-toggle-btn"
              :title="holiday.дата_конца ? 'Сделать однодневным' : 'Сделать периодом (несколько дней)'"
              @click.prevent="toggleHolidayRange(holiday)"
            >
              {{ holiday.дата_конца ? '📅 1 день' : '📆 Период' }}
            </button>
            <span v-if="isNewYearCrossing(holiday)" class="badge-new-year-crossing text-xs">
              🌙 Переход года
            </span>
          </div>
          <div class="item-actions">
            <button
              class="btn-icon interactive-el"
              :disabled="Number(hIdx) === 0"
              @click.prevent="moveItem(Number(hIdx), -1)"
            >
              ↑
            </button>
            <button
              class="btn-icon interactive-el"
              :disabled="Number(hIdx) === (modelValue.праздники?.length || 0) - 1"
              @click.prevent="moveItem(Number(hIdx), 1)"
            >
              ↓
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="removeHoliday(Number(hIdx))"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addHoliday">➕ Добавить праздник</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useCalendarHolidays } from './useCalendarHolidays';
import type { CalendarData } from "../../../../services/Calendars/calendar.types";

const props = defineProps<{
  modelValue: CalendarData;
}>();

const { isCollapsed, wheelHorizontal, getDaysInMonth, moveItem, addHoliday, removeHoliday, toggleHolidayRange, isNewYearCrossing } = useCalendarHolidays(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarHolidays.css"></style>

