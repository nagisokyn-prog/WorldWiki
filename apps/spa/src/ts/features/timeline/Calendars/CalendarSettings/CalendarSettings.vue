<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">⚙️ Физика времени и планеты</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="grid-2">
        <div class="calendar-field">
          <label class="glass-label">Часов в сутках</label>
          <input v-model.number="settings.часов_в_сутках" type="number" min="1" class="interactive-el">
        </div>
        <div class="calendar-field">
          <label class="glass-label">Минут в часе</label>
          <input v-model.number="settings.минут_в_часе" type="number" min="1" class="interactive-el">
        </div>
      </div>
      
      <div v-if="isMaster" style="margin-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-color);">
          <input v-model="settings.учитывать_сезонную_длительность_дня" type="checkbox" class="interactive-el">
          <span>Учитывать световой день и солнцестояния <span title="Позволяет движку (CalendarMath) высчитывать точное время рассвета и заката для каждого дня в году, выстраивая синусоиду между летним и зимним солнцестоянием. Полезно для реалистичной смены дня и ночи." style="cursor: help; color: #3498db; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span></span>
        </label>
        
        <div v-if="settings.учитывать_сезонную_длительность_дня" style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
          <div class="calendar-field">
            <label class="glass-label">
              Широта (0 = экватор, 90 = полюс)
              <span title="Точка обзора (где находятся герои). Служит подсказкой для ИИ о климате региона: 0 - тропики (нет зимы), 45 - средняя полоса (4 сезона), 90 - полюс (полярная ночь)." style="cursor: help; color: #3498db; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span>
            </label>
            <input v-model.number="settings.широта" type="number" min="-90" max="90" class="interactive-el" style="max-width: 33.3%;">
            <small class="glass-label">Влияет на лор. Реальный расчет физики идет по часам ниже.</small>
          </div>
          
          <div v-if="dayLengthAnchor" class="grid-2">
            <div class="calendar-field">
              <label class="glass-label" style="color: #f39c12;">
                Летнее солнцестояние (часы света)
                <span title="Самый длинный световой день в году. Движок будет плавно увеличивать световой день до этого значения к середине лета." style="cursor: help; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span>
              </label>
              <input v-model.number="dayLengthAnchor.summer_solstice_hours" type="number" min="1" max="100" step="0.1" class="interactive-el">
            </div>
            <div class="calendar-field">
              <label class="glass-label" style="color: #3498db;">
                Зимнее солнцестояние (часы света)
                <span title="Самый короткий световой день в году. Движок будет плавно уменьшать световой день до этого значения к середине зимы." style="cursor: help; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span>
              </label>
              <input v-model.number="dayLengthAnchor.winter_solstice_hours" type="number" min="0" max="100" step="0.1" class="interactive-el">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarSettings } from './useCalendarSettings';
import type { CalendarSettingsProps } from './useCalendarSettings';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

const props = withDefaults(defineProps<CalendarSettingsProps>(), {
  isMaster: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: CalendarData): void;
}>();

const { isCollapsed, settings, dayLengthAnchor } = useCalendarSettings(props, emit);
</script>

<style scoped src="./CalendarSettings.vue.css"></style>
