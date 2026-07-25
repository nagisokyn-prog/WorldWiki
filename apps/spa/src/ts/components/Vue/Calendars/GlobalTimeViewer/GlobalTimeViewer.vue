<template>
  <Transition name="fade">
  <div v-if="isVisible" class="global-time-viewer" v-motion-slide-top>
    <div class="header">
      <h3><i class="fas fa-globe"></i> Мировое Время</h3>
      <button @click="close" class="close-btn">×</button>
    </div>
    
    <div class="content">
      <div class="master-clock">
        <label>Абсолютная минута (Master Clock)</label>
        <div class="clock-input-group">
          <button @click="minute -= 1000">-</button>
          <input type="number" v-model.number="minute" />
          <button @click="minute += 1000">+</button>
        </div>
      </div>

      <div class="local-calendars" v-auto-animate>
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
import { useGlobalTimeViewer } from './useGlobalTimeViewer';

const {
  isVisible,
  minute,
  localDates,
  loading,
  open,
  close
} = useGlobalTimeViewer();
</script>

<style scoped src="./GlobalTimeViewer.vue.css"></style>
