<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">🌙 Луны и фазы</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div v-auto-animate class="item-list">
        <div v-for="(moon, mIdx) in calendar.moons" :key="mIdx" class="item-row moon-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <input v-model="moon.name" type="text" class="item-name interactive-el" placeholder="Название луны">
            <label class="glass-label" style="font-size: 11px;">Период (дней):</label>
            <input v-model.number="moon.period_days" type="number" min="1" step="0.1" class="item-duration interactive-el" style="width: 80px;">
            
            <label class="glass-label" style="font-size: 11px;">Старт. фаза (0-1):</label>
            <input v-model.number="moon.initial_phase" type="number" min="0" max="1" step="0.05" class="item-duration interactive-el" style="width: 70px;" title="0 = Новолуние, 0.5 = Полнолуние">
            
            <div class="item-actions">
              <button class="btn-icon interactive-el" :disabled="Number(mIdx)===0" @click.prevent="moveItem(calendar.moons, Number(mIdx), -1)">↑</button>
              <button class="btn-icon interactive-el" :disabled="Number(mIdx)===(calendar.moons?.length || 0)-1" @click.prevent="moveItem(calendar.moons, Number(mIdx), 1)">↓</button>
              <button class="btn-icon interactive-el" @click.prevent="calendar.moons.splice(Number(mIdx), 1)">🗑️</button>
            </div>
          </div>
          
          <div v-if="moon.phase_names" style="display: flex; gap: 8px; font-size: 12px; margin-left: 8px;">
            <input v-model="moon.phase_names.new" type="text" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Новолуние">
            <input v-model="moon.phase_names.waxing" type="text" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Растущая">
            <input v-model="moon.phase_names.full" type="text" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Полнолуние">
            <input v-model="moon.phase_names.waning" type="text" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Убывающая">
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addMoon">➕ Добавить луну</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarMoons } from './useCalendarMoons';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update:modelValue']);

const { isCollapsed, calendar, addMoon, moveItem } = useCalendarMoons(props, emit);
</script>

<style scoped src="./CalendarMoons.vue.css"></style>
