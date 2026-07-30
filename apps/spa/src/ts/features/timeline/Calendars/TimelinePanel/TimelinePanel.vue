<template>
  <div class="tool-section timeline-section">
    <h4><i class="fas fa-calendar-alt"></i> Таймлайн главы</h4>
    
    <!-- Селектор типа календаря -->
    <div class="calendar-selector multi-calendar-selector">
      <label>Отображаемые календари:</label>
      <div class="calendar-pills" v-if="availableCalendars.length > 0">
        <button 
          v-for="cal in availableCalendars" 
          :key="cal.id"
          class="calendar-pill interactive-el"
          :class="{ active: selectedCalendarIds.includes(cal.id) }"
          @click="toggleCalendarSelection(cal.id)"
        >
          {{ cal.data.название || 'Календарь' }}
        </button>
      </div>
      <div v-else style="font-size: 12px; color: var(--text-muted);">
        Нет доступных календарей
      </div>
    </div>
    
    <div class="timeline-events-list" v-auto-animate>
      <div v-if="events.length === 0" style="color: var(--text-muted); font-size: 12px; padding: 10px;">
        Нет событий в таймлайне.
      </div>
      
      <div v-for="(ev, idx) in events" :key="idx" class="timeline-event-item">
        <div class="event-header" style="cursor: pointer;" @click="toggleExpand(idx)">
          <div class="header-left">
            <span class="expand-icon">{{ isExpanded(idx) ? '▼' : '▶' }}</span>
            <span class="event-title">Событие {{ idx + 1 }}</span>
          </div>
          <button class="delete-btn" @click.stop="removeEvent(idx)">🗑️</button>
        </div>
        
        <div v-show="isExpanded(idx)" class="event-content">
          <!-- Визуальное отображение даты и сезона -->
        <div class="date-display-column">
          <div 
            v-for="calId in selectedCalendarIds" 
            :key="calId" 
            class="date-display multi-date-display"
          >
            <template v-if="getConvertedDateInfo(ev, calId)">
              <div class="cal-badge-name" :class="{ 'native-cal': getConvertedDateInfo(ev, calId)?.isNative }" :title="getConvertedDateInfo(ev, calId)?.isNative ? 'Родной календарь события' : ''">
                {{ getConvertedDateInfo(ev, calId)?.calName }}
              </div>
              <div class="season-badge" :style="{ background: getConvertedDateInfo(ev, calId)?.seasonColor }">
                {{ getConvertedDateInfo(ev, calId)?.seasonName }}
              </div>
              <div class="date-text">
                {{ getConvertedDateInfo(ev, calId)?.dateStr }}
              </div>
              <div class="time-of-day-badge" :style="{ background: getConvertedDateInfo(ev, calId)?.timeOfDayColor }">
                {{ getConvertedDateInfo(ev, calId)?.timeOfDayName }}
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
  isExpanded,
  toggleExpand,
  removeEvent,
  getConvertedDateInfo,
  getUniversalDateObject,
  updateEventFullDate,
  onChange,
  relativeInput,
  createNextEvent,
  addEvent
} = useTimelinePanel(props, emit);
</script>
<style src="../../../../../../../../packages/resources/src/styles/modules/timeline-panel.css" scoped></style>
