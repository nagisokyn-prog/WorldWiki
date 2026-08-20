<template>
  <div class="calendar-section">
    <div class="section-header weekdays-section-header" @click="isCollapsed = !isCollapsed">
      <h4 class="m-0">📅 Дни недели</h4>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" class="mt-3">
      <div v-auto-animate class="item-list">
        <div v-for="(day, dIdx) in modelValue.названия_дней_недели" :key="dIdx" class="item-row">
          <input
            :value="day"
            type="text"
            class="item-name weekday-input interactive-el"
            @input="updateDay(Number(dIdx), ($event.target as HTMLInputElement).value)"
          />
          <div class="item-actions">
            <button
              class="btn-icon interactive-el"
              :disabled="Number(dIdx) === 0"
              @click.prevent="moveItem(Number(dIdx), -1)"
            >
              ↑
            </button>
            <button
              class="btn-icon interactive-el"
              :disabled="Number(dIdx) === (modelValue.названия_дней_недели?.length || 0) - 1"
              @click.prevent="moveItem(Number(dIdx), 1)"
            >
              ↓
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="removeDay(Number(dIdx))"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addDay">➕ Добавить день</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarWeekdays } from './useCalendarWeekdays';
import type { CalendarWeekdaysProps } from './useCalendarWeekdays';

const props = defineProps<CalendarWeekdaysProps>();

const { isCollapsed, moveItem, addDay, updateDay, removeDay } = useCalendarWeekdays(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarWeekdays.css"></style>

