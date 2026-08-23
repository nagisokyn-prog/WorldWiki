<template>
  <div class="calendar-section">
    <div class="section-header moons-section-header" @click="isCollapsed = !isCollapsed">
      <h4 class="m-0">🌙 Луны и фазы</h4>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" class="mt-3">
      <div v-auto-animate class="item-list">
        <div v-for="(moon, mIdx) in calendar.moons" :key="mIdx" class="item-row moon-row flex-col items-stretch gap-2">
          <div class="flex gap-2 items-center">
            <input v-model="moon.name" type="text" class="item-name interactive-el" placeholder="Название луны">
            <label class="glass-label text-xs">Период (дней):</label>
            <input v-model.number="moon.period_days" type="number" min="1" step="0.1" class="item-duration interactive-el" style="width: 80px;">
            
            <label class="glass-label text-xs">Старт. фаза (0-1):</label>
            <input v-model.number="moon.initial_phase" type="number" min="0" max="1" step="0.05" class="item-duration interactive-el" style="width: 70px;" title="0 = Новолуние, 0.5 = Полнолуние">
            
            <div class="item-actions">
              <button class="btn-icon interactive-el" :disabled="Number(mIdx)===0" @click.prevent="moveItem(calendar.moons, Number(mIdx), -1)">↑</button>
              <button class="btn-icon interactive-el" :disabled="Number(mIdx)===(calendar.moons?.length || 0)-1" @click.prevent="moveItem(calendar.moons, Number(mIdx), 1)">↓</button>
              <button class="btn-icon interactive-el" @click.prevent="calendar.moons?.splice(Number(mIdx), 1)">🗑️</button>
            </div>
          </div>
          
          <div v-if="moon.phase_names" class="moon-phase-inputs">
            <input v-model="moon.phase_names.new" type="text" class="interactive-el phase-input" placeholder="Новолуние">
            <input v-model="moon.phase_names.waxing" type="text" class="interactive-el phase-input" placeholder="Растущая">
            <input v-model="moon.phase_names.full" type="text" class="interactive-el phase-input" placeholder="Полнолуние">
            <input v-model="moon.phase_names.waning" type="text" class="interactive-el phase-input" placeholder="Убывающая">
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addMoon">➕ Добавить луну</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarMoons } from './useCalendarMoons';
import type { CalendarMoonsProps } from './useCalendarMoons';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

const props = defineProps<CalendarMoonsProps>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: CalendarData): void;
}>();

const { isCollapsed, calendar, addMoon, moveItem } = useCalendarMoons(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarMoons.css"></style>
