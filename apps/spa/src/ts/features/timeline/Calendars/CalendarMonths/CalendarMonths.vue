<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">📆 Месяцы</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div v-auto-animate class="item-list">
        <div v-for="(month, mIdx) in modelValue.месяцы" :key="mIdx" class="item-row">
          <input v-model="month.название" type="text" class="item-name interactive-el" style="max-width: 120px;" />
          <input
            v-model.number="month.дней"
            type="number"
            min="1"
            max="100"
            class="item-duration interactive-el"
            style="max-width: 60px;"
          />
          <div class="item-actions">
            <button
              class="btn-icon interactive-el"
              :disabled="Number(mIdx) === 0"
              @click.prevent="moveItem(Number(mIdx), -1)"
            >
              ↑
            </button>
            <button
              class="btn-icon interactive-el"
              :disabled="Number(mIdx) === (modelValue.месяцы?.length || 0) - 1"
              @click.prevent="moveItem(Number(mIdx), 1)"
            >
              ↓
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="removeMonth(Number(mIdx))"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addMonth">➕ Добавить месяц</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarMonths } from './useCalendarMonths';
import type { CalendarMonthsProps } from './useCalendarMonths';

const props = defineProps<CalendarMonthsProps>();

const { isCollapsed, moveItem, addMonth, removeMonth } = useCalendarMonths(props);
</script>
