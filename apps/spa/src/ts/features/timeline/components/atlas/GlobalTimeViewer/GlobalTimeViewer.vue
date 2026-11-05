<template>
  <Transition name="fade">
  <div v-if="isVisible" v-motion-slide-top class="global-time-viewer">
    <div class="header">
      <h3><i class="fas fa-globe"></i> Мировое Время</h3>
      <button class="close-btn" @click="close">×</button>
    </div>
    
    <div class="content">
      <div class="master-clock">
        <label>Абсолютная минута (Master Clock)</label>
        <div class="clock-input-group">
          <button @click="handlePrevMinute">-</button>
          <input :value="minute" type="number" @input="handleMinuteInput" />
          <button @click="handleNextMinute">+</button>
        </div>
      </div>

      <div v-auto-animate class="local-calendars">
        <h4>Конвертация в локальные календари:</h4>
        <div v-if="loading" class="loading">Загрузка календарей...</div>
        <div v-for="cal in localDates" :key="cal.id" class="calendar-card">
          <div class="cal-name">{{ cal.name }}</div>
          <div class="cal-date">
            {{ cal.date.year }} год, Месяц {{ cal.date.month }}, День {{ cal.date.day }}
          </div>
          <div class="cal-time">
            {{ String(cal.date.hour).padStart(2, '0') }}:{{ String(cal.date.minute).padStart(2, '0') }}
          </div>
        </div>
      </div>
    </div>
  </div>
  </Transition>
</template>

<script setup lang="ts">
import type { GlobalTimeViewerProps } from './GlobalTimeViewer.model';
import { useGlobalTimeViewer } from './useGlobalTimeViewer';

const props = defineProps<GlobalTimeViewerProps>();

const {
  isVisible,
  minute,
  localDates,
  loading,
  close,
  handlePrevMinute,
  handleNextMinute,
  handleMinuteInput
} = useGlobalTimeViewer(() => props.projectName);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/GlobalTimeViewer.css"></style>
