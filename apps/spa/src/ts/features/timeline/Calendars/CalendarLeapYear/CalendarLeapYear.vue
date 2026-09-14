<template>
  <div class="calendar-section calendar-leap-card">
    <div class="leap-section-header" @click="isCollapsed = !isCollapsed">
      <h4>📅 Високосный год</h4>
      <span class="leap-collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-if="!isCollapsed" class="leap-content">
      <div class="grid-2">
        <div class="calendar-field">
          <label>Правило</label>
          <XboxWheel
            :model-value="modelValue.правило_високосного_года"
            :horizontal="wheelHorizontal"
            :options="[
              { value: 'григорианское', label: 'Григорианское' },
              { value: 'пользовательское', label: 'Пользовательское' },
              { value: 'отсутствует', label: 'Отсутствует' },
            ]"
            @update:model-value="updateRule"
          >
          </XboxWheel>
        </div>
        <div v-if="modelValue.правило_високосного_года === 'пользовательское'" class="calendar-field">
          <label>Месяц +N дней</label>
          <XboxWheel
            v-model.number="customRuleMonth"
            :horizontal="wheelHorizontal"
            :options="
              (modelValue.месяцы || []).map((m: any, idx: number) => ({
                value: idx,
                label: m.название,
              }))
            "
          >
          </XboxWheel>
          <div class="custom-offset-row">
            <label>Смещение (дней):</label>
            <input
              v-model.number="customRuleDays"
              type="number"
              class="interactive-el offset-input"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useCalendarLeapYear } from './useCalendarLeapYear';
import type { CalendarLeapYearProps } from './useCalendarLeapYear';

const props = defineProps<CalendarLeapYearProps>();

const { isCollapsed, wheelHorizontal, updateRule, customRuleMonth, customRuleDays } = useCalendarLeapYear(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarLeapYear.css"></style>
