<template>
  <div class="tool-section timeline-section">
    <div class="flex items-center justify-between mb-2">
      <h4 class="m-0"><i class="fas fa-calendar-alt"></i> Таймлайн главы</h4>
      <button
        v-if="events.length > 1"
        type="button"
        class="glass-btn btn-sm interactive-el"
        title="Упорядочить хронологически по абсолютному времени"
        @click="sortByAbsoluteTime"
      >
        ⏱️ По хронологии
      </button>
    </div>
    
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
      
      <div v-for="(ev, idx) in displayEvents" :key="ev.idx" class="timeline-event-item">
        <div class="event-header" @click="toggleExpand(idx)">
          <div class="header-left">
            <span class="expand-icon">{{ ev.isExpanded ? '▼' : '▶' }}</span>
            <span class="event-title">Событие {{ idx + 1 }}</span>
          </div>
          <button class="delete-btn" @click.stop="removeEvent(idx)">🗑️</button>
        </div>
        
        <div v-if="ev.isExpanded" class="event-content">
          <!-- Визуальное отображение даты и сезона -->
        <div class="date-display-column">
          <div 
            v-for="cal in ev.calendarDisplays" 
            :key="cal.calId" 
            class="date-display multi-date-display"
          >
            <div class="cal-badge-name" :class="{ 'native-cal': cal.info.isNative }" :title="cal.info.isNative ? 'Родной календарь события' : ''">
              {{ cal.info.calName }}
            </div>
            <div class="season-badge" :style="{ '--season-bg': cal.info.seasonColor }">
              {{ cal.info.seasonName }}
            </div>
            <div class="date-text">
              {{ cal.info.dateStr }}
            </div>
            <div class="time-of-day-badge" :data-time="cal.info.timeOfDayType">
              {{ cal.info.timeOfDayName }}
            </div>
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
import type { TimelinePanelProps, TimelinePanelEmits } from './TimelinePanel.model';
import { UniversalDatePicker } from '@/shared/ui';
import { useTimelinePanel, type TimelineEvent } from './useTimelinePanel';

const props = withDefaults(defineProps<TimelinePanelProps>(), {
  events: () => []
});

const emit = defineEmits(['update:events', 'change']);

const {
  availableCalendars,
  selectedCalendarIds,
  toggleCalendarSelection,
  displayEvents,
  toggleExpand,
  removeEvent,
  getUniversalDateObject,
  updateEventFullDate,
  onChange,
  relativeInput,
  createNextEvent,
  addEvent,
  sortByAbsoluteTime,
} = useTimelinePanel(props, emit as (event: string, ...args: unknown[]) => void);
</script>
<style src="@worldwiki/resources/styles/features/timeline/TimelinePanel.css" scoped></style>
