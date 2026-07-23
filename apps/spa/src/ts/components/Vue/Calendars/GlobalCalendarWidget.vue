<template>
  <div class="global-calendar-widget glass-panel">
    <div class="gc-header">
      <span class="gc-icon">🌍</span>
      <span class="gc-title">{{ masterCalendar?.data?.название || 'Календарь Мира' }}</span>
    </div>

    <div v-if="masterCalendar" class="gc-content">
      <!-- Контролы мирового времени -->
      <div class="gc-controls">
        <label style="font-size: 10px; color: var(--text-muted);">Мировое время (Год, Месяц, День)</label>
        <div style="display: flex; gap: 4px; margin-bottom: 8px;">
           <input type="number" v-model.number="currentMasterInput.year" class="interactive-el" style="width: 60px" title="Год">
           <select v-model.number="currentMasterInput.month" class="interactive-el" style="flex: 1;" title="Месяц">
             <option v-for="(m, i) in masterCalendar.data.месяцы" :key="i" :value="i">{{ m.название }}</option>
           </select>
           <input type="number" v-model.number="currentMasterInput.day" class="interactive-el" style="width: 50px" title="День">
        </div>
        <div style="font-size: 12px; font-weight: bold; color: var(--accent); margin-bottom: 12px;">
          {{ formattedMasterDate }}
        </div>
      </div>

      <!-- Конвертер в локальные -->
      <div v-if="localCalendars.length > 0" class="gc-local-converter" style="border-top: 1px solid var(--border-color); padding-top: 8px;">
        <label style="font-size: 10px; color: var(--text-muted);">Перевод в локальный календарь</label>
        <select v-model="selectedLocalCal" class="interactive-el" style="width: 100%; margin: 4px 0;">
          <option :value="null">-- Выберите локальный --</option>
          <option v-for="cal in localCalendars" :key="cal.id" :value="cal.id">{{ cal.data?.название || 'Безымянный' }}</option>
        </select>
        <div v-if="selectedLocalCal" class="gc-local-result" style="font-size: 12px; font-weight: bold; padding: 4px; background: rgba(0,0,0,0.1); border-radius: 4px; margin-top: 4px;">
          ➡️ {{ formattedLocalDate }}
        </div>
      </div>
    </div>
    
    <div v-else class="gc-empty">
      <small>Загрузка календаря...</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { calendarService } from '../../../services/calendar.service';
import { CalendarMath } from '../../../services/Calendars/calendar.math';

const props = defineProps<{ project: string }>();

const masterCalendar = ref<any>(null);
const localCalendars = ref<any[]>([]);

const selectedLocalCal = ref<string | null>(null);

// Состояние текущего "введенного" мирового времени
const currentMasterInput = ref({
  era_index: 0,
  year: 1,
  month: 0,
  day: 1,
  hour: 12,
  minute: 0
});

const loadCalendars = async () => {
  const list = await calendarService.getCalendars(props.project);
  masterCalendar.value = list.find(c => c.is_master);
  localCalendars.value = list.filter(c => !c.is_master);
};

onMounted(() => {
  loadCalendars();
});

// Вычисляем абсолютную минуту на основе введенных данных мастера
const currentAbsoluteMinute = computed(() => {
  if (!masterCalendar.value?.data) return 0;
  return CalendarMath.getAbsoluteMinute(currentMasterInput.value, masterCalendar.value.data);
});

// Форматированная строка мастера
const formattedMasterDate = computed(() => {
  if (!masterCalendar.value?.data) return '';
  const dateObj = { 
    absolute_minute: currentAbsoluteMinute.value,
    calendar_id: masterCalendar.value.id,
    original_input: currentMasterInput.value
  };
  return CalendarMath.formatDate(masterCalendar.value.data, dateObj);
});

// Форматированная строка локального календаря
const formattedLocalDate = computed(() => {
  if (!selectedLocalCal.value) return '';
  const localCal = localCalendars.value.find(c => c.id === selectedLocalCal.value);
  if (!localCal?.data) return '';
  
  // Конвертируем из абсолютной минуты мирового календаря в локальный
  const localInput = CalendarMath.getDateFromAbsolute(currentAbsoluteMinute.value, localCal.data, 0); // TODO: era
  
  const dateObj = {
    absolute_minute: currentAbsoluteMinute.value,
    calendar_id: localCal.id,
    original_input: localInput
  };
  
  return CalendarMath.formatDate(localCal.data, dateObj);
});
</script>

<style scoped>
.global-calendar-widget {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-panel);
}
.gc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.gc-title {
  font-weight: bold;
  font-size: 13px;
  color: var(--text-main);
}
.gc-icon {
  font-size: 16px;
}
.gc-controls input, .gc-controls select {
  font-size: 12px;
  padding: 4px;
}
</style>
