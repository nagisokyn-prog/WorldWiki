<template>
  <div class="tool-section timeline-section">
    <h4><i class="fas fa-calendar-alt"></i> Календари проекта</h4>
    
    <div class="timeline-events-list">
      <div
        v-if="!project"
        class="calendar-warning-box"
      >
        ⚠️ Пожалуйста, введите название произведения выше, чтобы создавать календари.
      </div>
      <div
        v-else-if="calendars.length === 0"
        class="calendar-empty-box"
      >
        Нет календарей в проекте. Создайте первый календарь!
      </div>
      
      <div v-for="(cal, idx) in displayCalendars" :key="cal.id || idx" class="timeline-event-item">
        <div class="event-header cursor-pointer" @click="toggleExpand(idx)">
          <div class="header-left">
            <span class="expand-icon">{{ cal.isExpanded ? '▼' : '▶' }}</span>
            <span class="event-title">{{ cal.data?.название || 'Новый календарь' }}</span>
            <span v-if="cal.is_master" class="badge-master">🌍 Календарь Мира</span>
            <span v-else-if="cal.is_default" class="badge-default-accent">По умолчанию</span>
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn-icon interactive-el" title="Диагностический аудит календаря" @click.stop="openAudit(cal.data)">🔍</button>
            <button type="button" class="btn-icon interactive-el" :class="cal.is_default ? 'is-default' : 'is-dimmed'" title="Сделать основным" @click.stop="setDefault(cal.idx)">🌟</button>
            <button type="button" class="btn-icon interactive-el" title="Сохранить" @click.stop="saveCalendar(cal.idx)">💾</button>
            <button v-if="!cal.is_master" type="button" class="delete-btn" @click.stop="removeCalendar(cal.idx)">🗑️</button>
          </div>
        </div>
        
        <div v-if="cal.isExpanded" class="event-content">
          
          <div class="calendar-settings-section">
            <div class="grid-2">
              <div class="calendar-field">
                <label>Название календаря</label>
                <input v-model="cal.data.название" type="text" class="interactive-el">
              </div>
              <div class="calendar-field">
                <label>Дней в году</label>
                <input v-model.number="cal.data.дней_в_году" type="number" min="1" class="interactive-el" placeholder="365">
              </div>
            </div>
            <div v-if="!cal.is_master && masterCalendar?.timezones && masterCalendar.timezones.length > 0" class="calendar-field mt-3">
              <label>🌍 Часовой пояс региона в Мире</label>
              <select v-model="cal.data.default_timezone_id" class="interactive-el glass-select">
                <option :value="undefined">По умолчанию (0 мин / Основной)</option>
                <option v-for="tz in masterCalendar.timezones" :key="tz.id" :value="tz.id">
                  {{ tz.name }} ({{ tz.base_offset_hours >= 0 ? '+' : '' }}{{ tz.base_offset_hours }} ч)
                </option>
              </select>
            </div>
          </div>

          <div class="calendar-top-row-grid">
            <CalendarSettings v-model="cal.data" :is-master="cal.is_master" />
            <CalendarPlanetPhysics v-model="cal.data" />
            <DialHierarchyConstructor v-model="cal.data" />
            <CalendarWeekdays v-model="cal.data" />
            <CalendarMonths v-model="cal.data" />
            <CalendarExtraDays v-model="cal.data" />
            <CalendarOrigin v-model="cal.data" />
            <CalendarLeapYear v-model="cal.data" />
            <CalendarEras v-model="cal.data" />
            <CharacterAgeSettings v-model="cal.data" />
          </div>

          <div class="calendar-middle-row-grid">
            <CalendarSeasons v-model="cal.data" />
            <CalendarMoons v-if="cal.is_master" v-model="cal.data" />
            <CalendarTimezones v-if="cal.is_master" v-model="cal.data" />
          </div>

          <div v-if="!cal.is_master" class="calendar-full-row-grid">
            <CalendarSyncAnchor v-model="cal.data" :master-calendar="masterCalendar" />
          </div>

          <div class="calendar-full-row-grid">
            <CalendarHolidays v-model="cal.data" />
          </div>
          <CalendarPlayground :calendar="cal.data" @set-origin="setStoryOrigin(idx)" />

        </div>
      </div>
      
      <button v-if="project" type="button" class="glass-btn btn-add-event btn-add-calendar-full interactive-el" @click.prevent="addCalendar">
        <i class="fas fa-plus"></i> Создать новый календарь
      </button>

      <CalendarAuditModal
        v-if="selectedAuditCalendar"
        v-model="isAuditOpen"
        :calendar="selectedAuditCalendar"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import CalendarSettings from "../Calendars/CalendarSettings/CalendarSettings.vue";
import CalendarPlanetPhysics from "../Calendars/CalendarPlanetPhysics/CalendarPlanetPhysics.vue";
import DialHierarchyConstructor from "../Calendars/DialHierarchyConstructor/DialHierarchyConstructor.vue";
import CalendarWeekdays from "../Calendars/CalendarWeekdays/CalendarWeekdays.vue";
import CalendarMonths from "../Calendars/CalendarMonths/CalendarMonths.vue";
import CalendarExtraDays from "../Calendars/CalendarExtraDays/CalendarExtraDays.vue";
import CalendarOrigin from "../Calendars/CalendarOrigin/CalendarOrigin.vue";
import CalendarLeapYear from "../Calendars/CalendarLeapYear/CalendarLeapYear.vue";
import CalendarEras from "../Calendars/CalendarEras/CalendarEras.vue";
import CharacterAgeSettings from "../Calendars/CharacterAgeSettings/CharacterAgeSettings.vue";
import CalendarSeasons from "../Calendars/CalendarSeasons/CalendarSeasons.vue";
import CalendarMoons from "../Calendars/CalendarMoons/CalendarMoons.vue";
import CalendarTimezones from "../Calendars/CalendarTimezones/CalendarTimezones.vue";
import CalendarHolidays from "../Calendars/CalendarHolidays/CalendarHolidays.vue";
import CalendarPlayground from "../Calendars/CalendarPlayground/CalendarPlayground.vue";
import CalendarSyncAnchor from "../Calendars/CalendarSyncAnchor/CalendarSyncAnchor.vue";
import CalendarAuditModal from "../Calendars/CalendarAuditModal/CalendarAuditModal.vue";
import { useCalendarsPanel } from './useCalendarsPanel';

const props = defineProps<{ project?: string }>();

const {
  project,
  calendars,
  displayCalendars,
  masterCalendar,
  toggleExpand,
  addCalendar,
  saveCalendar,
  removeCalendar,
  setDefault,
  setStoryOrigin,
  saveAll,
  isAuditOpen,
  selectedAuditCalendar,
  openAudit,
} = useCalendarsPanel(props);

defineExpose({ saveAll });
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarsPanel.css"></style>
