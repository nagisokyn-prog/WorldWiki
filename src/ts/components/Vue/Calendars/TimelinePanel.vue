<template>
  <div class="tool-section timeline-section">
    <h4><i class="fas fa-calendar-alt"></i> Таймлайн главы</h4>
    
    <!-- Селектор типа календаря -->
    <div class="calendar-selector">
      <label for="calendar-select">Выбрать календарь:</label>
      <XboxWheel 
        v-if="calendarOptions.length > 0"
        :horizontal="wheelHorizontal"
        :model-value="selectedCalendarId" 
        :options="calendarOptions"
        @update:model-value="(val: any) => { selectedCalendarId = val; onCalendarChange(); }"
      />
      <div v-else style="font-size: 12px; color: var(--text-muted);">
        Нет доступных календарей
      </div>
    </div>
    
    <div class="timeline-events-list">
      <div v-if="events.length === 0" style="color: var(--text-muted); font-size: 12px; padding: 10px;">
        Нет событий в таймлайне.
      </div>
      
      <div v-for="(ev, idx) in events" :key="idx" class="timeline-event-item">
        <div class="event-header" @click="toggleExpand(idx)" style="cursor: pointer;">
          <div class="header-left">
            <span class="expand-icon">{{ isExpanded(idx) ? '▼' : '▶' }}</span>
            <span class="event-title">Событие {{ idx + 1 }}</span>
          </div>
          <button @click.stop="removeEvent(idx)" class="delete-btn">🗑️</button>
        </div>
        
        <div v-show="isExpanded(idx)" class="event-content">
          <!-- Визуальное отображение даты и сезона -->
        <div class="date-display">
          <div class="season-badge" :style="{ background: getSeasonColor(ev) }">
            {{ getSeasonName(ev) }}
          </div>
          <div class="date-text">
            {{ formatEventDate(ev) }}
          </div>
        </div>
        
        <!-- Xbox Wheel селекторы для даты -->
        <div class="date-selector-grid">
          <!-- Эра -->
          <div class="wheel-wrapper-container">
            <label>Эра</label>
            <XboxWheel :horizontal="wheelHorizontal"
              :model-value="ev.date.era"
              :options="eraOptions"
              @update:model-value="(val: any) => updateEventDate(idx, 'era', val)"
            />
          </div>
          
          <!-- Год -->
          <div class="wheel-wrapper-container compact">
            <label>Год</label>
            <input 
              type="number" 
              :value="ev.date.year" 
              @input="(e) => updateEventDate(idx, 'year', parseInt((e.target as HTMLInputElement).value))"
              class="year-input"
            >
          </div>
          
          <!-- Месяц -->
          <div class="wheel-wrapper-container">
            <label>Месяц</label>
            <XboxWheel :horizontal="wheelHorizontal"
              :model-value="ev.date.month"
              :options="monthOptions"
              @update:model-value="(val: any) => updateEventDate(idx, 'month', val)"
            />
          </div>
          
          <!-- День -->
          <div class="wheel-wrapper-container compact">
            <label>День</label>
            <input 
              type="number" 
              :value="ev.date.day" 
              @input="(e) => updateEventDate(idx, 'day', parseInt((e.target as HTMLInputElement).value))"
              class="day-input"
              :max="getDaysInMonth(ev.date.month)"
            >
          </div>
        </div>
        
        <!-- Время -->
        <div class="time-selector">
          <label>🕒 Время суток</label>
          <div class="time-wheels-container">
            <XboxWheel :horizontal="wheelHorizontal"
              :model-value="ev.time?.hour || 0"
              :options="hourOptions"
              @update:model-value="(val: any) => updateEventTime(idx, 'hour', val)"
            />
            <span class="time-separator">:</span>
            <XboxWheel :horizontal="wheelHorizontal"
              :model-value="ev.time?.minute || 0"
              :options="minuteOptions"
              @update:model-value="(val: any) => updateEventTime(idx, 'minute', val)"
            />
          </div>
          <div class="time-of-day-badge" :style="{ background: getTimeOfDayColor(ev) }">
            {{ getTimeOfDayName(ev) }}
          </div>
        </div>
        
        <!-- Описание события -->
          <textarea 
            v-model="ev.description" 
            @input="onChange" 
            placeholder="Описание события..." 
            class="event-description"
          ></textarea>

          <!-- Авто-шаг -->
          <div class="auto-step-container">
            <input type="text" v-model="relativeInput[idx]" placeholder="Спустя... (напр: 2 месяца 1 день)" class="interactive-el relative-input">
            <button class="btn-icon interactive-el" @click.stop="createNextEvent(idx)" title="Создать следующее событие с вычисленной датой">➡️</button>
          </div>
        </div>
      </div>
    </div>
    
    <button class="add-timeline-btn" @click="addEvent">
      <i class="fas fa-plus"></i> Добавить дату
    </button>
  </div>
</template>
<script src="../../../services/Calendars/timeline-panel.ts" lang="ts"></script>
<style src="../../../../css/modules/timeline-panel.css" scoped></style>
