<template>
  <div class="calendar-section calendar-settings-card">
    <div class="section-header settings-section-header" @click="isCollapsed = !isCollapsed">
      <div class="settings-header-left">
        <h4 class="m-0">{{ title }}</h4>
        <button
          v-if="!props.isMaster"
          type="button"
          class="settings-help-btn interactive-el"
          title="Справка о местном делении времени"
          @click.stop="toggleTooltip"
        >
          ❓
        </button>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed && showTooltip && !props.isMaster" class="settings-help-popover">
      <strong>Местное деление суток и часов:</strong>
      <p class="m-0 mt-1">Определяет, как данная культура делит одни и те же астрономические сутки планеты на свои циферблаты:</p>
      <ul>
        <li><strong>Древний Китай:</strong> сутки делили на 100 «кэ» (刻) вместо 24 часов.</li>
        <li><strong>Французская революция:</strong> 10 десятичных часов по 100 минут.</li>
        <li><strong>Эфиопия:</strong> сутки начинаются на рассвете, а календарь отстает на 7–8 лет.</li>
      </ul>
    </div>
    
    <div v-if="!isCollapsed" class="mt-3">
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

const { isCollapsed, settings, title, showTooltip, toggleTooltip } = useCalendarSettings(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarSettings.css"></style>

