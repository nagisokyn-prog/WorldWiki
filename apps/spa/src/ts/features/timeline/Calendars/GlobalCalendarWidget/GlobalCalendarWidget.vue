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
        <button class="gc-step-btn interactive-el" :class="{ 'is-active': isExplainerOpen }" title="🔮 Объяснить дату (сводка для рукописи)" @click="toggleExplainer">🔮</button>
        <button class="gc-atlas-btn interactive-el" title="Открыть Атлас Времени (Синхронизатор)" @click="openAtlas">
          <i class="fas fa-expand-alt"></i>
        </button>
      </div>
    </div>

    <div v-if="masterCalendar" class="gc-content">
      <!-- Мировое время с интерактивными инпутами дня, месяца и года -->
      <div class="gc-world-date-box">
        <div class="gc-date-edit-row">
          <input
            v-model.number="currentMasterInput.day"
            type="number"
            min="1"
            :max="maxDaysInCurrentMonth"
            class="interactive-el gc-day-input"
            title="День"
          />
          <select
            v-model.number="currentMasterInput.month"
            class="interactive-el gc-month-select"
            title="Месяц"
          >
            <option
              v-for="(m, mIdx) in masterCalendar?.data?.месяцы || []"
              :key="mIdx"
              :value="mIdx"
            >
              {{ m.название }}
            </option>
          </select>
          <input
            v-model.number="currentMasterInput.year"
            type="number"
            class="interactive-el gc-year-input"
            title="Год"
          />
          <span class="gc-year-suffix">г.</span>
        </div>

        <div class="gc-time-badge-row">
          <div class="gc-time-inputs" title="Время суток">
            <span class="gc-time-icon">🕐</span>
            <input
              v-model.number="currentMasterInput.hour"
              type="number"
              min="0"
              :max="maxHoursInDay - 1"
              class="interactive-el gc-time-input"
              title="Час"
            />
            <span class="gc-time-colon">:</span>
            <input
              v-model.number="currentMasterInput.minute"
              type="number"
              min="0"
              :max="maxMinutesInHour - 1"
              class="interactive-el gc-time-input"
              title="Минуты"
            />
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

      <!-- Карточка «Объяснить дату» для автора -->
      <CalendarExplainerCard
        v-if="isExplainerOpen && dateExplanation"
        :date-explanation="dateExplanation"
        :is-copied="isCopied"
        @close="closeExplainer"
        @copy-snippet="copySnippet"
      />
    </div>

    <div v-else class="gc-empty">
      <small v-if="isLoading">Загрузка календаря...</small>
      <small v-else>Календарь не настроен</small>
    </div>

    <!-- Модальное окно Атласа Времени -->
    <TimeAtlasModal
      :project="props.project"
      :is-open="isAtlasOpen"
      @close="closeAtlas"
    />
  </div>
</template>

<script setup lang="ts">
import { useGlobalCalendarWidget } from './useGlobalCalendarWidget';
import CalendarExplainerCard from './CalendarExplainerCard.vue';
import TimeAtlasModal from '../TimeAtlas/TimeAtlasModal.vue';
import type { GlobalCalendarWidgetProps } from './GlobalCalendarWidget.model';

const props = defineProps<GlobalCalendarWidgetProps>();

const {
  masterCalendar,
  localCalendars,
  selectedLocalCal,
  currentMasterInput,
  maxDaysInCurrentMonth,
  maxHoursInDay,
  maxMinutesInHour,
  formattedLocalDate,
  activeMoons,
  activeHoliday,
  isAtlasOpen,
  isLoading,
  openAtlas,
  closeAtlas,
  prevDay,
  nextDay,
  isExplainerOpen,
  toggleExplainer,
  closeExplainer,
  dateExplanation,
  isCopied,
  copySnippet,
} = useGlobalCalendarWidget(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/GlobalCalendarWidget.css"></style>
