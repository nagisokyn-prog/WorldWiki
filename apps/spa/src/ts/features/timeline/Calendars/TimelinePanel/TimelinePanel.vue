<template>
  <div class="tool-section timeline-section">
    <h4><i class="fas fa-calendar-alt"></i> Таймлайн главы</h4>
    
    <!-- Селектор типа календаря -->
    <div class="calendar-selector multi-calendar-selector">
      <label>Отображаемые календари:</label>
      <div v-if="availableCalendars.length > 0" class="calendar-pills">
        <button 
          v-for="cal in availableCalendars" 
          :key="cal.id || 'cal'"
          class="calendar-pill interactive-el"
          :class="{ active: cal.id ? selectedCalendarIds.includes(cal.id) : false }"
          @click="cal.id && toggleCalendarSelection(cal.id)"
        >
          {{ cal.data?.название || 'Календарь' }}
        </button>
      </div>
      <div v-else class="empty-calendars-hint">
        Нет доступных календарей
      </div>
    </div>
    
    <div class="timeline-events-list">
      <div v-if="events.length === 0" class="empty-events-hint">
        Нет событий в таймлайне.
      </div>
      
      <div v-for="(ev, idx) in events" :key="idx" class="timeline-event-item">
        <div class="event-header" @click="toggleExpand(idx)">
          <div class="header-left">
            <span class="expand-icon">{{ isExpanded(idx) ? '▼' : '▶' }}</span>
            <span class="event-title">Событие {{ idx + 1 }}</span>
          </div>
          <button class="delete-btn" @click.stop="removeEvent(idx)">🗑️</button>
        </div>
        
        <div v-if="isExpanded(idx)" class="event-content">
          <!-- Визуальное отображение даты и сезона -->
        <div class="date-display-column">
          <div 
            v-for="calId in getDisplayCalendarIds(ev)" 
            :key="calId" 
            class="date-display multi-date-display"
          >
            <template v-if="convertedDateInfoMap.get(`${idx}:${calId}`)">
              <div class="cal-badge-name" :class="{ 'native-cal': convertedDateInfoMap.get(`${idx}:${calId}`)?.isNative }" :title="convertedDateInfoMap.get(`${idx}:${calId}`)?.isNative ? 'Родной календарь события' : ''">
                {{ convertedDateInfoMap.get(`${idx}:${calId}`)?.calName }}
              </div>
              <div class="season-badge" :style="{ '--season-bg': convertedDateInfoMap.get(`${idx}:${calId}`)?.seasonColor }">
                {{ convertedDateInfoMap.get(`${idx}:${calId}`)?.seasonName }}
              </div>
              <div class="date-text">
                {{ convertedDateInfoMap.get(`${idx}:${calId}`)?.dateStr }}
              </div>
              <div class="time-of-day-badge" :style="{ '--time-bg': convertedDateInfoMap.get(`${idx}:${calId}`)?.timeOfDayColor }">
                {{ convertedDateInfoMap.get(`${idx}:${calId}`)?.timeOfDayName }}
              </div>
            </template>
          </div>
        </div>
        
        <!-- Универсальный селектор даты и времени -->
        <UniversalDatePicker
          :model-value="getUniversalDateObject(ev)"
          :project="project"
          :show-time="true"
          @update:model-value="(val: any) => updateEventFullDate(idx, val)"
        />
        
        <!-- Описание события -->
          <textarea 
            v-model="ev.description" 
            placeholder="Описание события..." 
            class="event-description" 
            @input="onChange"
          ></textarea>

          <!-- Авто-шаг -->
          <div class="auto-step-container">
            <input v-model="relativeInput[idx]" type="text" placeholder="Спустя... (напр: 2 месяца 1 день)" class="interactive-el relative-input">
            <button class="btn-icon interactive-el" title="Создать следующее событие с вычисленной датой" @click.stop="createNextEvent(idx)">➡️</button>
          </div>
        </div>
      </div>
    </div>
    
    <button class="add-timeline-btn" @click="addEvent">
      <i class="fas fa-plus"></i> Добавить дату
    </button>
  </div>
</template>
<script setup lang="ts">
import UniversalDatePicker from '../../UniversalDatePicker/UniversalDatePicker.vue';
import { useTimelinePanel, type TimelineEvent } from './useTimelinePanel';

const props = withDefaults(defineProps<{
  project: string;
  events?: TimelineEvent[];
}>(), {
  events: () => []
});

const emit = defineEmits(['update:events', 'change']);

const {
  availableCalendars,
  selectedCalendarIds,
  toggleCalendarSelection,
  getDisplayCalendarIds,
  isExpanded,
  toggleExpand,
  removeEvent,
  convertedDateInfoMap,
  getUniversalDateObject,
  updateEventFullDate,
  onChange,
  relativeInput,
  createNextEvent,
  addEvent
} = useTimelinePanel(props, emit as (event: string, ...args: unknown[]) => void);
</script>
<style src="@worldwiki/resources/styles/features/timeline/TimelinePanel.css" scoped></style>
