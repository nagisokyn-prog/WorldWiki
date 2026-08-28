<template>
  <div class="global-calendar-widget glass-panel">
    <div class="gc-header">
      <div class="gc-header-left">
        <span class="gc-icon">🌍</span>
        <span class="gc-title">{{ masterCalendar?.data?.название || 'Календарь Мира' }}</span>
      </div>
      <div class="gc-header-actions">
        <button class="gc-step-btn interactive-el" title="Предыдущий день" @click="prevDay">◀</button>
        <button class="gc-step-btn interactive-el" title="Следующий день" @click="nextDay">▶</button>
        <button class="gc-atlas-btn interactive-el" title="Открыть Атлас Времени (Синхронизатор)" @click="openAtlas">
          <i class="fas fa-expand-alt"></i>
        </button>
      </div>
    </div>

    <div v-if="masterCalendar" class="gc-content">
      <!-- Мировое время с контролами -->
      <div class="gc-world-date-box">
        <div class="gc-date-primary">
          {{ formattedMasterDate }}
        </div>
        <div class="gc-badges-row">
          <span v-if="activeHoliday" class="gc-badge holiday-badge" title="Праздник в Календаре Мира">
            🎉 Праздник
          </span>
          <span
            v-for="(moon, mIdx) in activeMoons"
            :key="mIdx"
            class="gc-badge moon-badge"
            :title="`${moon.moon.name}: ${moon.name}`"
          >
            {{ moon.emoji }}
          </span>
        </div>
      </div>

      <!-- Сравнительный локальный календарь -->
      <div v-if="localCalendars.length > 0" class="gc-local-section">
        <div class="gc-local-selector-row">
          <span class="gc-local-label">Сравнение:</span>
          <select v-model="selectedLocalCal" class="interactive-el gc-select">
            <option v-for="cal in localCalendars" :key="cal.id" :value="cal.id">
              {{ cal.data?.название || 'Безымянный' }}
            </option>
          </select>
        </div>

        <div v-if="selectedLocalCal" class="gc-local-result">
          <span class="gc-arrow">↳</span>
          <span class="gc-local-text">{{ formattedLocalDate }}</span>
        </div>
      </div>
    </div>

    <div v-else class="gc-empty">
      <small>Загрузка календаря...</small>
    </div>

    <!-- Модальное окно Атласа Времени -->
    <TimeAtlasModal
      :project="project"
      :is-open="isAtlasOpen"
      @close="closeAtlas"
    />
  </div>
</template>

<script setup lang="ts">
import { useGlobalCalendarWidget } from './useGlobalCalendarWidget';
import TimeAtlasModal from '../TimeAtlas/TimeAtlasModal.vue';

const props = defineProps<{ project: string }>();

const {
  masterCalendar,
  localCalendars,
  selectedLocalCal,
  formattedMasterDate,
  formattedLocalDate,
  activeMoons,
  activeHoliday,
  isAtlasOpen,
  openAtlas,
  closeAtlas,
  prevDay,
  nextDay,
} = useGlobalCalendarWidget(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/GlobalCalendarWidget.css"></style>
