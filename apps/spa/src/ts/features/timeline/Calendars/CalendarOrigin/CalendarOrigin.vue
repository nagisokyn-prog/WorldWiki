<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">🎯 Точка отсчёта</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div v-if="modelValue.точка_отсчета" class="grid-3">
        <div class="calendar-field">
          <label>Год</label>
          <input
            :value="modelValue.точка_отсчета.год"
            type="number"
            class="interactive-el"
            @input="updateOriginField('год', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="calendar-field">
          <label>Месяц</label>
          <XboxWheel
            :model-value="modelValue.точка_отсчета.месяц"
            :horizontal="wheelHorizontal"
            :options="
              (modelValue.месяцы || []).map((m: any, idx: number) => ({
                value: idx,
                label: m.название,
              }))
            "
            @update:model-value="val => updateOriginField('месяц', Number(val))"
          >
          </XboxWheel>
        </div>
        <div class="calendar-field">
          <label>День</label>
          <input
            :value="modelValue.точка_отсчета.день"
            type="number"
            min="1"
            :max="
              getDaysInMonth(modelValue, modelValue.точка_отсчета.год, modelValue.точка_отсчета.месяц)
            "
            class="interactive-el"
            @input="updateOriginField('день', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
      <div v-if="modelValue.точка_отсчета" class="calendar-field">
        <label>День недели</label>
        <XboxWheel
          :model-value="modelValue.точка_отсчета.день_недели"
          :horizontal="wheelHorizontal"
          :options="
            (modelValue.названия_дней_недели || []).map((day: string, idx: number) => ({
              value: idx,
              label: day,
            }))
          "
          @update:model-value="val => updateOriginField('день_недели', Number(val))"
        >
        </XboxWheel>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useCalendarOrigin } from './useCalendarOrigin';
import type { CalendarData } from "../../../../services/Calendars/calendar.types";

const props = defineProps<{
  modelValue: CalendarData;
}>();

const { isCollapsed, wheelHorizontal, getDaysInMonth, updateOriginField } = useCalendarOrigin(props);
</script>
