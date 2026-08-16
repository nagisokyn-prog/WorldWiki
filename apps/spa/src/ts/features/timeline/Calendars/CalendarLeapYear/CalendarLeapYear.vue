<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">📅 Високосный год</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
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
          <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px">
            <label style="margin: 0">Смещение (дней):</label>
            <input
              v-model.number="customRuleDays"
              type="number"
              class="interactive-el"
              style="width: 60px"
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

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const { isCollapsed, wheelHorizontal, updateRule, customRuleMonth, customRuleDays } = useCalendarLeapYear(props);
</script>
