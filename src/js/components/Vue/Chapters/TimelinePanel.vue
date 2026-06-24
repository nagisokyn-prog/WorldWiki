<template>
  <div class="tool-section timeline-section">
    <h4><i class="fas fa-calendar-alt"></i> Таймлайн главы</h4>
    
    <!-- Селектор типа календаря -->
    <div class="calendar-selector">
      <label for="calendar-select">Выбрать календарь:</label>
      <select 
        id="calendar-select"
        v-model="selectedCalendarId" 
        @change="onCalendarChange"
        class="calendar-select"
      >
        <option v-for="cal in availableCalendars" :key="cal.id" :value="cal.id">
          {{ cal.data.название || 'Календарь' }}
        </option>
      </select>
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
              @update:model-value="(val) => updateEventDate(idx, 'era', val)"
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
              @update:model-value="(val) => updateEventDate(idx, 'month', val)"
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
              @update:model-value="(val) => updateEventTime(idx, 'hour', val)"
            />
            <span class="time-separator">:</span>
            <XboxWheel :horizontal="wheelHorizontal"
              :model-value="ev.time?.minute || 0"
              :options="minuteOptions"
              @update:model-value="(val) => updateEventTime(idx, 'minute', val)"
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
        </div>
      </div>
    </div>
    
    <button class="add-timeline-btn" @click="addEvent">
      <i class="fas fa-plus"></i> Добавить дату
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { PropType } from 'vue';
import { calendarService } from '../../../services/calendar.service';
import XboxWheel from '../XboxWheel.vue';
import { settingsService } from '../../../../../tauri-surreal-kit/frontend/src/js/services/settings.service';

const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

interface TimelineEvent {
  date: {
    era: number;
    year: number;
    month: number;
    day: number;
  };
  time?: {
    hour?: number;
    minute?: number;
  };
  description: string;
  calendar_id?: string;
}

const props = defineProps({
  project: { type: String, required: true },
  events: { type: Array as PropType<TimelineEvent[]>, required: true }
});

const emit = defineEmits(['update:events', 'change']);

const calendar = ref<any>(null);
const eras = ref<any[]>([]);
const months = ref<any[]>([]);
const showTimeSettings = ref(false);
const expandedIndices = ref<Set<number>>(new Set());
const availableCalendars = ref<any[]>([]);
const selectedCalendarId = ref<string | null>(null);

const isExpanded = (idx: number) => {
  // По умолчанию все развернуты, если еще не взаимодействовали
  // Или если хотим по умолчанию свернуты - тогда пустой сет
  return expandedIndices.value.has(idx);
};

const toggleExpand = (idx: number) => {
  if (expandedIndices.value.has(idx)) {
    expandedIndices.value.delete(idx);
  } else {
    expandedIndices.value.add(idx);
  }
};

// Вычисляемые опции для wheel
const eraOptions = computed(() => {
  return eras.value.map((era, idx) => ({
    value: idx,
    label: era.название || era.name || `Эра ${idx + 1}`
  }));
});

const monthOptions = computed(() => {
  return months.value.map((month, idx) => ({
    value: idx,
    label: month.название || month.name || `Месяц ${idx + 1}`
  }));
});

const hourOptions = computed(() => {
  const cal = calendar.value;
  const hoursInDay = cal?.настройки_времени?.часов_в_сутках || 24;
  return Array.from({ length: hoursInDay }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}`
  }));
});

const minuteOptions = computed(() => {
  const cal = calendar.value;
  const minsInHour = cal?.настройки_времени?.минут_в_часе || 60;
  return Array.from({ length: minsInHour }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}`
  }));
});

onMounted(async () => {
  try {
    // Загружаем список всех календарей
    const calendarsList = await calendarService.getCalendars(props.project);
    availableCalendars.value = calendarsList.map(c => ({
      id: c.id,
      is_default: c.is_default,
      data: c.data || calendarService.getDefaultCalendar()
    }));
    
    // Устанавливаем выбранный календарь (по умолчанию или первый)
    const defaultCal = availableCalendars.value.find(c => c.is_default) || availableCalendars.value[0];
    if (defaultCal) {
      selectedCalendarId.value = defaultCal.id;
      loadCalendarData(defaultCal);
      
      // Обновляем calendar_id для существующих событий, если его нет
      const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
      let hasChanges = false;
      newEvents.forEach(event => {
        if (!event.calendar_id) {
          event.calendar_id = defaultCal.id;
          hasChanges = true;
        }
      });
      if (hasChanges) {
        emit('update:events', newEvents);
      }
    }
  } catch (e) {
    console.warn('Could not load calendars, using defaults', e);
    // Fallback к дефолтному календарю
    const defaultCal = {
      id: 'default',
      is_default: true,
      data: calendarService.getDefaultCalendar()
    };
    availableCalendars.value = [defaultCal];
    selectedCalendarId.value = 'default';
    loadCalendarData(defaultCal);
    
    // Обновляем calendar_id для существующих событий
    const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
    let hasChanges = false;
    newEvents.forEach(event => {
      if (!event.calendar_id) {
        event.calendar_id = 'default';
        hasChanges = true;
      }
    });
    if (hasChanges) {
      emit('update:events', newEvents);
    }
  }

  settingsService.onChange(s => wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal');
});

// Загружаем данные выбранного календаря
const loadCalendarData = (calObj: any) => {
  const cal = calObj.data;
  if (cal && calendarService.isValidCalendar(cal)) {
    calendar.value = cal;
    calendar.value._id = calObj.id;
    if (cal.эпохи && cal.эпохи.length > 0) eras.value = cal.эпохи;
    if (cal.месяцы && cal.месяцы.length > 0) months.value = cal.месяцы;
    
    if (cal.настройки_времени) {
      showTimeSettings.value = true;
    }
  }
};

// Обработчик смены календаря
const onCalendarChange = () => {
  const selected = availableCalendars.value.find(c => c.id === selectedCalendarId.value);
  if (selected) {
    loadCalendarData(selected);
    
    // Обновляем calendar_id для всех событий
    const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
    newEvents.forEach(event => {
      event.calendar_id = selectedCalendarId.value || undefined;
    });
    emit('update:events', newEvents);
    onChange();
  }
};

// Получить цвет сезона
const getSeasonColor = (event: TimelineEvent): string => {
  if (!calendar.value) return 'rgba(139, 92, 246, 0.2)';
  
  const season = calendarService.getSeasonForDate(
    calendar.value,
    event.date.year,
    event.date.month
  );
  
  const seasonColors: Record<string, string> = {
    'Весна': 'rgba(34, 197, 94, 0.3)', // green
    'Лето': 'rgba(245, 158, 11, 0.3)', // amber
    'Осень': 'rgba(239, 68, 68, 0.3)', // red
    'Зима': 'rgba(59, 130, 246, 0.3)', // blue
  };
  
  return seasonColors[season] || 'rgba(139, 92, 246, 0.2)';
};

// Получить название сезона
const getSeasonName = (event: TimelineEvent): string => {
  if (!calendar.value) return 'Без сезона';
  return calendarService.getSeasonForDate(
    calendar.value,
    event.date.year,
    event.date.month
  );
};

// Получить время суток
const getTimeOfDayName = (event: TimelineEvent): string => {
  const hour = event.time?.hour || 12;
  
  if (hour >= 5 && hour < 12) return '🌅 Утро';
  if (hour >= 12 && hour < 17) return '☀️ День';
  if (hour >= 17 && hour < 21) return '🌆 Вечер';
  return '🌙 Ночь';
};

// Получить цвет времени суток
const getTimeOfDayColor = (event: TimelineEvent): string => {
  const hour = event.time?.hour || 12;
  
  if (hour >= 5 && hour < 12) return 'rgba(249, 115, 22, 0.3)'; // orange - утро
  if (hour >= 12 && hour < 17) return 'rgba(251, 191, 36, 0.3)'; // yellow - день
  if (hour >= 17 && hour < 21) return 'rgba(249, 115, 22, 0.3)'; // orange - вечер
  return 'rgba(59, 130, 246, 0.3)'; // blue - ночь
};

// Форматировать дату события
const formatEventDate = (event: TimelineEvent): string => {
  if (!calendar.value) return '';
  
  const era = eras.value[event.date.era];
  const month = months.value[event.date.month];
  
  let dateStr = `${event.date.year} год, ${month?.название || month?.name || 'Месяц'} ${event.date.day}`;
  
  if (era) {
    dateStr += ` (${era.название || era.name})`;
  }
  
  if (event.time?.hour !== undefined) {
    dateStr += `, ${String(event.time.hour).padStart(2, '0')}:${String(event.time.minute || 0).padStart(2, '0')}`;
  }
  
  return dateStr;
};

// Получить количество дней в месяце
const getDaysInMonth = (monthIdx: number): number => {
  if (!calendar.value) return 30;
  return calendar.value.месяцы[monthIdx]?.дней || 30;
};

// Обновить дату события
const updateEventDate = (idx: number, field: string, value: number) => {
  const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
  
  if (field === 'era') newEvents[idx].date.era = value;
  if (field === 'year') newEvents[idx].date.year = value;
  if (field === 'month') newEvents[idx].date.month = value;
  if (field === 'day') {
    // Ограничить день максимальным для месяца
    const maxDay = getDaysInMonth(newEvents[idx].date.month);
    newEvents[idx].date.day = Math.min(value, maxDay);
  }
  
  emit('update:events', newEvents);
  onChange();
};

// Обновить время события
const updateEventTime = (idx: number, field: string, value: number) => {
  const newEvents = JSON.parse(JSON.stringify(props.events)) as TimelineEvent[];
  
  if (!newEvents[idx].time) {
    newEvents[idx].time = { hour: 0, minute: 0 };
  }
  
  if (field === 'hour') newEvents[idx].time!.hour = value;
  if (field === 'minute') newEvents[idx].time!.minute = value;
  
  emit('update:events', newEvents);
  onChange();
};

const addEvent = () => {
  const newEvents = [...(props.events as TimelineEvent[])];
  newEvents.push({
    date: { era: 0, year: 1, month: 0, day: 1 },
    time: { hour: 12, minute: 0 },
    description: '',
    calendar_id: selectedCalendarId.value || undefined
  });
  expandedIndices.value.add(newEvents.length - 1); // Развернуть новое событие
  emit('update:events', newEvents);
  onChange();
};

const removeEvent = (idx: number) => {
  const newEvents = [...(props.events as TimelineEvent[])];
  newEvents.splice(idx, 1);
  emit('update:events', newEvents);
  onChange();
};

const onChange = () => {
  emit('change');
};
</script>

<style scoped>
.tool-section {
  margin-bottom: 24px;
}

.tool-section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-events-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 12px;
}

.timeline-event-item {
  background: var(--bg-input);
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.timeline-event-item:hover {
  border-color: var(--border-active);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
}

.event-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-icon {
  font-size: 10px;
  color: var(--text-muted);
  width: 12px;
  transition: transform 0.2s;
}

.event-content {
  margin-top: 12px;
}

.delete-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.2s;
  padding: 4px;
}

.delete-btn:hover {
  transform: scale(1.2);
}

.date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px 8px;
  background: rgba(139, 92, 246, 0.05);
  border-radius: 6px;
}

.season-badge {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-main);
  min-width: max-content;
}

.date-text {
  font-size: 12px;
  color: var(--text-main);
  font-weight: 500;
}

.date-selector-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.wheel-wrapper-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 120px;
  min-width: 0;
  max-width: 220px;
}

.wheel-wrapper-container.compact {
  flex: 0 0 80px;
  min-width: 80px;
}

.wheel-wrapper-container label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.year-input,
.day-input {
  padding: 6px 10px;
  background: var(--bg-panel);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.2s;
  width: 100%;
}

.year-input:focus,
.day-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
  outline: none;
}

.time-selector {
  padding: 8px;
  background: rgba(139, 92, 246, 0.05);
  border-radius: 6px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.time-selector label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.time-wheels-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-wheels-container :deep(.dropdown-container) {
  flex: 1;
  min-width: 80px;
}

.time-separator {
  font-weight: bold;
  font-size: 18px;
  color: var(--text-muted);
}

.time-of-day-badge {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
  text-align: center;
  align-self: flex-start;
}

.event-description {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-panel);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  resize: vertical;
  min-height: 50px;
  font-family: inherit;
  font-size: 12px;
  transition: all 0.2s;
}

.event-description:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
  outline: none;
}

.add-timeline-btn {
  width: 100%;
  padding: 10px;
  background: var(--bg-input);
  border: 1px dashed var(--border-color);
  color: var(--text-main);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  font-weight: 500;
}

.add-timeline-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--accent);
  color: var(--accent);
}

.calendar-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.calendar-selector label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.calendar-select {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-input);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.calendar-select:hover {
  border-color: var(--accent);
}

.calendar-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
  outline: none;
}

.calendar-select option {
  background: var(--bg-panel);
  color: var(--text-main);
}
</style>

