<template>
  <div class="tool-section timeline-section">
    <h4><i class="fas fa-calendar-alt"></i> Календари проекта</h4>
    
    <div class="timeline-events-list" v-auto-animate>
      <div
        v-if="!project"
        style="color: #e74c3c; font-size: 12px; padding: 10px; text-align: center; border: 1px dashed var(--border-color); border-radius: 8px;"
      >
        ⚠️ Пожалуйста, введите название произведения выше, чтобы создавать календари.
      </div>
      <div
        v-else-if="calendars.length === 0"
        style="color: var(--text-muted); font-size: 12px; padding: 10px"
      >
        Нет календарей в проекте. Создайте первый календарь!
      </div>
      
      <div v-for="(cal, idx) in calendars" :key="cal.id || idx" class="timeline-event-item">
        <div class="event-header" style="cursor: pointer;" @click="toggleExpand(idx)">
          <div class="header-left">
            <span class="expand-icon">{{ isExpanded(idx) ? '▼' : '▶' }}</span>
            <span class="event-title">{{ cal.data?.название || 'Новый календарь' }}</span>
            <span v-if="cal.is_master" class="badge-default" style="margin-left: 8px; font-size: 10px; background: #e67e22; color: white; padding: 2px 6px; border-radius: 4px;">🌍 Календарь Мира</span>
            <span v-else-if="cal.is_default" class="badge-default" style="margin-left: 8px; font-size: 10px; background: var(--accent); color: white; padding: 2px 6px; border-radius: 4px;">По умолчанию</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-icon interactive-el" title="Сделать основным" :style="{ opacity: cal.is_default ? 1 : 0.5 }" @click.stop="setDefault(idx)">🌟</button>
            <button type="button" class="btn-icon interactive-el" title="Сохранить" @click.stop="saveCalendar(idx)">💾</button>
            <button v-if="!cal.is_master" type="button" class="delete-btn" @click.stop="removeCalendar(idx)">🗑️</button>
          </div>
        </div>
        
        <div v-show="isExpanded(idx)" class="event-content">
          
          <div class="calendar-settings-section">
            <div class="grid-2">
              <div class="calendar-field">
                <label>Название календаря</label>
                <input v-model="cal.data.название" type="text" class="interactive-el">
              </div>
              <div class="calendar-field">
                <label>Дней в неделе</label>
                <input v-model.number="cal.data.дней_в_неделе" type="number" min="1" max="20" class="interactive-el">
              </div>
            </div>
          </div>

          <div class="calendar-top-row-grid">
            <CalendarSettings :is-master="cal.is_master" v-model="cal.data" />
            <CalendarWeekdays v-model="cal.data" />
            <CalendarMonths v-model="cal.data" />
            <CalendarLeapYear v-model="cal.data" />
            <CalendarEras v-model="cal.data" />
          </div>

          <div class="calendar-middle-row-grid">
            <CalendarSeasons v-model="cal.data" />
            <CalendarMoons v-if="cal.is_master" v-model="cal.data" />
            <CalendarTimezones v-if="cal.is_master" v-model="cal.data" />
          </div>

          <div class="calendar-full-row-grid">
            <CalendarHolidays v-model="cal.data" />
          </div>
          <CalendarPlayground :calendar="cal.data" />

        </div>
      </div>
      
      <button v-if="project" type="button" class="glass-btn btn-add-event interactive-el" style="width: 100%; justify-content: center; margin-top: 10px;" @click.prevent="addCalendar">
        <i class="fas fa-plus"></i> Создать новый календарь
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import CalendarSettings from "../Calendars/CalendarSettings/CalendarSettings.vue";
import CalendarWeekdays from "../Calendars/CalendarWeekdays/CalendarWeekdays.vue";
import CalendarMonths from "../Calendars/CalendarMonths/CalendarMonths.vue";
import CalendarLeapYear from "../Calendars/CalendarLeapYear/CalendarLeapYear.vue";
import CalendarEras from "../Calendars/CalendarEras/CalendarEras.vue";
import CalendarSeasons from "../Calendars/CalendarSeasons/CalendarSeasons.vue";
import CalendarMoons from "../Calendars/CalendarMoons/CalendarMoons.vue";
import CalendarTimezones from "../Calendars/CalendarTimezones/CalendarTimezones.vue";
import CalendarHolidays from "../Calendars/CalendarHolidays/CalendarHolidays.vue";
import CalendarPlayground from "../Calendars/CalendarPlayground/CalendarPlayground.vue";
import { useCalendarsPanel } from './useCalendarsPanel';

const props = defineProps<{ project?: string }>();

const {
  project,
  calendars,
  expandedCalendars,
  isExpanded,
  toggleExpand,
  addCalendar,
  saveCalendar,
  removeCalendar,
  setDefault,
  saveAll
} = useCalendarsPanel(props);

defineExpose({ saveAll });
</script>

<style scoped src="./CalendarsPanel.vue.css"></style>
