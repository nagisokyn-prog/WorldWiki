<template>
  <div class="calendar-section playground-section" :class="{ 'is-origin-disabled': !calendar.is_story_origin }">
    <div class="section-header playground-section-header" @click="handleHeaderClick">
      <div class="header-left">
        <label class="origin-checkbox-label" title="Точка отсчёта произведения" @click.stop>
          <input
            type="checkbox"
            :checked="calendar.is_story_origin"
            class="interactive-el origin-checkbox"
            @change="toggleStoryOrigin"
          />
        </label>
        <h4 class="text-accent m-0"><i class="fas fa-calendar-alt"></i> 📖 Дата первой главы (Точка отсчёта сюжета)</h4>
        <span v-if="calendar.is_story_origin" class="origin-active-badge">🌟 Точка отсчёта</span>
        <span v-else class="origin-inactive-hint text-xs text-muted">(Отметьте галочкой, чтобы развернуть)</span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ (isCollapsed || !calendar.is_story_origin) ? '▶' : '▼' }}</span>
    </div>
    
    <div v-if="!isCollapsed && calendar.is_story_origin" class="mt-4">
      
      <!-- Controls -->
      <div class="playground-controls">
        <div class="flex gap-3 items-center flex-wrap">
          <!-- Era -->
          <select v-if="calendar.эпохи && calendar.эпохи.length > 0" v-model.number="origin.эпоха" class="interactive-el glass-select">
            <option v-for="(era, idx) in calendar.эпохи" :key="idx" :value="idx">{{ era.название || `Эра ${idx+1}` }}</option>
          </select>
          
          <!-- Year -->
          <div class="flex items-center gap-1">
            <label class="text-xs text-muted">Год:</label>
            <input v-model.number="origin.год" type="number" class="interactive-el glass-input origin-year-input">
          </div>
          
          <!-- Month Nav -->
          <div class="month-nav-box">
            <button class="btn-icon interactive-el" title="Предыдущий месяц" @click="prevMonth">◀</button>
            <select v-model.number="origin.месяц" class="interactive-el glass-select origin-month-select">
              <option v-for="(m, idx) in calendar.месяцы" :key="idx" :value="idx">{{ m.название || `Месяц ${idx+1}` }}</option>
            </select>
            <button class="btn-icon interactive-el" title="Следующий месяц" @click="nextMonth">▶</button>
          </div>
          
          <!-- Day -->
          <div class="flex items-center gap-1">
            <label class="text-xs text-muted">День:</label>
            <input v-model.number="origin.день" type="number" class="interactive-el glass-input origin-day-input" min="1" :max="currentDaysCount">
          </div>
          
          <!-- Weekday -->
          <div v-if="calendar.названия_дней_недели && calendar.названия_дней_недели.length > 0" class="flex items-center gap-1">
            <label class="text-xs text-muted">День недели:</label>
            <select v-model.number="origin.день_недели" class="interactive-el glass-select">
              <option v-for="(day, idx) in calendar.названия_дней_недели" :key="idx" :value="idx">{{ day }}</option>
            </select>
          </div>
        </div>

        <div class="filters">
          <label class="filter-label"><input v-model="filters.seasons" type="checkbox"> Сезоны</label>
          <label class="filter-label"><input v-model="filters.moons" type="checkbox"> Луны</label>
          <label class="filter-label"><input v-model="filters.holidays" type="checkbox"> Праздники</label>
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-wrapper">
        <div class="calendar-grid" :style="{ '--days-in-week': daysInWeek }">
          <!-- Weekdays Header -->
          <div v-for="(dayName, idx) in weekdayNames" :key="'w'+idx" class="weekday-header">
            {{ dayName.slice(0, 3) }}
          </div>
          
          <!-- Empty slots for offset -->
          <div v-for="empty in startWeekdayOffset" :key="'e'+empty" class="day-cell empty-cell"></div>
          
          <!-- Actual Days -->
          <div
               v-for="day in gridDays" :key="'d'+day.day" 
               class="day-cell" 
               :class="{ 'is-holiday': day.holidayText, 'is-origin': day.isOrigin }"
               :style="{ '--season-color': filters.seasons ? day.seasonColor : 'transparent' }"
               :title="getDayTooltip(day)">
            
            <div class="day-number">{{ day.day }}</div>
            
            <div class="day-content">
              <!-- Origin Marker -->
              <div v-if="day.isOrigin" class="origin-marker" title="Точка отсчета (День 0)">🌟</div>
              
              <!-- Holiday Text -->
              <div v-if="day.holidayText && filters.holidays" class="holiday-text">
                {{ day.holidayText }}
              </div>
            </div>

            <!-- Moons Overlay -->
            <div v-if="filters.moons && day.moons && day.moons.length" class="moons-container">
              <template v-for="(m, mIdx) in day.moons" :key="mIdx">
                <div
                     v-if="m && isSignificantPhase(Number(m.phase))" 
                     class="moon-dot moon-dot-white" 
                     :title="`${m.emoji || ''} ${m.moon?.name || ''}: ${m.name || ''}`">
                </div>
              </template>
            </div>
            
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarPlayground } from './useCalendarPlayground';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

const props = defineProps<{
  calendar: CalendarData;
}>();

const emit = defineEmits<{
  (e: 'set-origin'): void;
}>();

const {
  isCollapsed,
  handleHeaderClick,
  toggleStoryOrigin,
  filters,
  origin,
  daysInWeek,
  weekdayNames,
  prevMonth,
  nextMonth,
  currentDaysCount,
  startWeekdayOffset,
  gridDays,
  getDayTooltip,
  isSignificantPhase
} = useCalendarPlayground(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarPlayground.css"></style>
