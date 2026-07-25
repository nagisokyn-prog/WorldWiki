<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">📅 Дни недели</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="item-list" v-auto-animate>
        <div v-for="(day, dIdx) in modelValue.названия_дней_недели" :key="dIdx" class="item-row">
          <input
            v-model="modelValue.названия_дней_недели[dIdx]"
            type="text"
            class="item-name interactive-el"
            style="max-width: 140px;"
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
              @click.prevent="modelValue.названия_дней_недели.splice(Number(dIdx), 1)"
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

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const { isCollapsed, moveItem, addDay } = useCalendarWeekdays(props);
</script>
