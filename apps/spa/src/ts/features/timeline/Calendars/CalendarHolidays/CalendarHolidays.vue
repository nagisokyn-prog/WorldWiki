<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">🎉 Праздники</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="item-list" v-auto-animate>
        <div v-for="(holiday, hIdx) in modelValue.праздники" :key="hIdx" class="item-row" style="display: flex; gap: 12px; align-items: center; width: 100%;">
          <input
            v-model="holiday.название"
            type="text"
            class="item-name interactive-el"
            placeholder="Название праздника"
            style="flex: 1;"
          />
          <div style="display: flex; gap: 12px; align-items: center; flex: 2;">
            <XboxWheel
              v-model.number="holiday.дата_начала.месяц"
              :horizontal="wheelHorizontal"
              :options="
                (modelValue.месяцы || []).map((m: any, mi: number) => ({
                  value: mi,
                  label: m.название,
                }))
              "
              style="flex: 1; min-width: 0;"
            >
            </XboxWheel>
              <input
              v-model.number="holiday.дата_начала.день"
              type="number"
              min="1"
              :max="
                getDaysInMonth(
                  modelValue,
                  modelValue.точка_отсчета?.год || 0,
                  holiday.дата_начала.месяц,
                )
              "
              style="width: 60px"
              class="interactive-el"
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
              style="flex: 1; min-width: 0;"
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
                  modelValue.точка_отсчета?.год || 0,
                  holiday.дата_конца.месяц,
                )
              "
              style="width: 60px"
              class="interactive-el"
            />
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
              @click.prevent="modelValue.праздники?.splice(Number(hIdx), 1)"
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

const { isCollapsed, wheelHorizontal, getDaysInMonth, moveItem, addHoliday } = useCalendarHolidays(props);
</script>
