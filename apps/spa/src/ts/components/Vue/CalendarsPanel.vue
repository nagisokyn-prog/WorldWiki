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
            <CalendarSettings v-if="cal.is_master" v-model="cal.data" />
            <CalendarWeekdays v-model="cal.data" />
            <CalendarMonths v-model="cal.data" />
            <CalendarLeapYear v-model="cal.data" />
            <CalendarEras v-model="cal.data" />
          </div>

          <div class="calendar-middle-row-grid" v-if="cal.is_master">
            <CalendarSeasons v-model="cal.data" />
            <CalendarMoons v-model="cal.data" />
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
import { ref, watch, onMounted, computed, nextTick } from 'vue';
import { calendarService } from "../../services/calendar.service";
import { CalendarMath } from "../../services/Calendars/calendar.math";
import CalendarSettings from "./Calendars/CalendarSettings.vue";
import CalendarWeekdays from "./Calendars/CalendarWeekdays.vue";
import CalendarMonths from "./Calendars/CalendarMonths.vue";
import CalendarLeapYear from "./Calendars/CalendarLeapYear.vue";
import CalendarEras from "./Calendars/CalendarEras.vue";
import CalendarSeasons from "./Calendars/CalendarSeasons.vue";
import CalendarMoons from "./Calendars/CalendarMoons.vue";
import CalendarHolidays from "./Calendars/CalendarHolidays.vue";
import CalendarPlayground from "./Calendars/CalendarPlayground.vue";

const props = defineProps<{ project?: string }>();
const project = computed(() => props.project || '');

const calendars = ref<any[]>([]);
const expandedCalendars = ref<Set<number>>(new Set());

const isExpanded = (idx: number) => expandedCalendars.value.has(idx);

const toggleExpand = (idx: number) => {
  if (expandedCalendars.value.has(idx)) {
    expandedCalendars.value.delete(idx);
  } else {
    expandedCalendars.value.add(idx);
  }
};

const loadCalendars = async () => {
  if (!project.value) {
    calendars.value = [];
    return;
  }
  
  try {
    const list = await calendarService.getCalendars(project.value);
    
    // Auto-create default calendar if none exist
    if (list.length === 0) {
      const defaultData = CalendarMath.getDefaultCalendar();
      await calendarService.saveCalendar(project.value, { ...defaultData, is_default: true, tempId: `temp_${Date.now()}` });
      const newList = await calendarService.getCalendars(project.value);
      calendars.value = newList.map(c => ({
        id: c.id,
        is_default: c.is_default,
        data: c.data || c
      }));
    } else {
      calendars.value = list.map(c => ({
        id: c.id,
        is_default: c.is_default,
        data: c.data || c
      }));
    }
    
    if (calendars.value.length > 0 && expandedCalendars.value.size === 0) {
      expandedCalendars.value.add(0);
    }
  } catch (error) {
    console.error('Ошибка при загрузке календарей:', error);
  }
};

watch(() => project.value, () => {
  loadCalendars();
}, { immediate: true });

const addCalendar = () => {
  const newCal = CalendarMath.getDefaultCalendar();
  newCal.название = `Новый календарь ${calendars.value.length + 1}`;
  
  calendars.value.push({
    id: `temp_${Date.now()}`,
    is_default: calendars.value.length === 0,
    data: newCal
  });
  
  expandedCalendars.value.add(calendars.value.length - 1);
};

const saveCalendar = async (idx: number) => {
  if (!project.value) return;
  
  const cal = calendars.value[idx];
  const payload = {
    ...cal.data,
    is_default: cal.is_default,
    id: cal.id?.startsWith('temp_') ? undefined : cal.id
  };
  
  try {
    const success = await calendarService.saveCalendar(project.value, payload);
    if (success) {
      // Reload to get real IDs
      await loadCalendars();
    }
  } catch (e) {
    console.error(e);
  }
};

const removeCalendar = async (idx: number) => {
  if (!confirm('Вы уверены, что хотите удалить этот календарь?')) return;
  if (!project.value) return;
  
  const cal = calendars.value[idx];
  if (!cal.id?.startsWith('temp_')) {
    // Ideally we would delete it via API, assuming deleteCalendar exists, else just ignore for this mock
  }
  calendars.value.splice(idx, 1);
  expandedCalendars.value.delete(idx);
};

const setDefault = async (idx: number) => {
  calendars.value.forEach((c, i) => {
    c.is_default = (i === idx);
  });
  await saveAll();
};

const saveAll = async () => {
  for (let i = 0; i < calendars.value.length; i++) {
    await saveCalendar(i);
  }
};

defineExpose({ saveAll });
</script>

<style scoped>
.tool-section { margin-bottom: 24px; }
.tool-section h4 { margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
.timeline-events-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 12px; }
.timeline-event-item { background: var(--bg-input); padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border-color); transition: all 0.3s ease; }
.timeline-event-item:hover { border-color: var(--border-active); box-shadow: 0 0 0 3px var(--accent-glow); }
.event-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; }
.event-title { font-size: 13px; font-weight: 600; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px; }
.header-left { display: flex; align-items: center; gap: 8px; }
.expand-icon { font-size: 10px; color: var(--text-muted); width: 12px; text-align: center; display: inline-block; }

.calendar-settings-section { margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.calendar-field { margin-bottom: 10px; display: flex; flex-direction: column; }
.calendar-field label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; }
.calendar-field input { background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: var(--text-color); padding: 6px 10px; border-radius: 6px; }

.btn-icon { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
.btn-icon:hover { color: var(--text-color); background: rgba(255, 255, 255, 0.1); }
.delete-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; }
.delete-btn:hover { opacity: 1; }
.btn-add-event { font-weight: 600; }

.calendar-top-row-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  align-items: start;
  margin-top: 16px;
}

.calendar-middle-row-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: start;
  margin-top: 16px;
}

.calendar-full-row-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
  margin-top: 16px;
}

@media (max-width: 1500px) {
  .calendar-top-row-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1000px) {
  .calendar-top-row-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .calendar-top-row-grid {
    grid-template-columns: 1fr;
  }
  .calendar-middle-row-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
/* Unscoped styles for child Calendar components */
.calendar-section {
  background: var(--glass-bg, rgba(20, 20, 20, 0.4));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.calendar-section h4 {
  margin-top: 0;
  margin-bottom: 12px;
  color: var(--text-color, #e0e0e0);
  font-size: 14px;
}
.calendar-section .item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.calendar-section .item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.calendar-section .item-name,
.calendar-section .item-duration,
.calendar-section input[type="text"],
.calendar-section input[type="number"] {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  color: var(--text-color, #e0e0e0);
  padding: 6px 10px;
  border-radius: 4px;
}
.calendar-section .item-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.calendar-section .btn-add {
  margin-top: 10px;
  background: transparent;
  border: 1px dashed var(--border-color, rgba(255, 255, 255, 0.2));
  color: var(--text-muted, #aaa);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.calendar-section .btn-add:hover {
  border-color: var(--accent, #3498db);
  color: var(--text-color, #fff);
  background: rgba(255, 255, 255, 0.05);
}
.calendar-section .btn-icon {
  background: transparent;
  border: none;
  color: var(--text-muted, #aaa);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}
.calendar-section .btn-icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-color, #fff);
}
.calendar-section .btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
