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
           <input v-model.number="currentMasterInput.year" type="number" class="interactive-el" style="width: 60px" title="Год">
           <select v-model.number="currentMasterInput.month" class="interactive-el" style="flex: 1;" title="Месяц">
             <option v-for="(m, i) in masterCalendar.data.месяцы" :key="i" :value="i">{{ m.название }}</option>
           </select>
           <input v-model.number="currentMasterInput.day" type="number" class="interactive-el" style="width: 50px" title="День">
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
import { useGlobalCalendarWidget } from './useGlobalCalendarWidget';

const props = defineProps<{ project: string }>();

const {
  masterCalendar,
  localCalendars,
  selectedLocalCal,
  currentMasterInput,
  formattedMasterDate,
  formattedLocalDate
} = useGlobalCalendarWidget(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/GlobalCalendarWidget.css"></style>
