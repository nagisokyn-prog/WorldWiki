<template>
  <div class="calendar-section">
    <div class="section-header settings-section-header" @click="isCollapsed = !isCollapsed">
      <h4 class="m-0">⚙️ Физика времени и планеты</h4>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" class="mt-3">
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
      
      <div v-if="isMaster" class="seasonal-box">
        <label class="settings-checkbox-label">
          <input v-model="settings.учитывать_сезонную_длительность_дня" type="checkbox" class="interactive-el">
          <span>Учитывать световой день и солнцестояния <span title="Позволяет движку (CalendarMath) высчитывать точное время рассвета и заката для каждого дня в году, выстраивая синусоиду между летним и зимним солнцестоянием. Полезно для реалистичной смены дня и ночи." class="help-icon">[?]</span></span>
        </label>
        
        <div v-if="settings.учитывать_сезонную_длительность_дня" class="mt-3 flex-col gap-3">
          <div class="calendar-field">
            <label class="glass-label">
               Широта (0 = экватор, 90 = полюс)
              <span title="Точка обзора (где находятся герои). Служит подсказкой для ИИ о климате региона: 0 - тропики (нет зимы), 45 - средняя полоса (4 сезона), 90 - полюс (полярная ночь)." class="help-icon">[?]</span>
            </label>
            <input v-model.number="settings.широта" type="number" min="-90" max="90" class="interactive-el latitude-input">
            <small class="glass-label">Влияет на лор. Реальный расчет физики идет по часам ниже.</small>
          </div>
          
          <div v-if="dayLengthAnchor" class="grid-2">
            <div class="calendar-field">
              <label class="glass-label label-summer">
                Летнее солнцестояние (часы света)
                <span title="Самый длинный световой день в году. Движок будет плавно увеличивать световой день до этого значения к середине лета." class="help-icon-summer">[?]</span>
              </label>
              <input v-model.number="dayLengthAnchor.summer_solstice_hours" type="number" min="1" max="100" step="0.1" class="interactive-el">
            </div>
            <div class="calendar-field">
              <label class="glass-label label-winter">
                Зимнее солнцестояние (часы света)
                <span title="Самый короткий световой день в году. Движок будет плавно уменьшать световой день до этого значения к середине зимы." class="help-icon">[?]</span>
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

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarSettings.css"></style>
