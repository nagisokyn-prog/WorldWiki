<template>
  <div class="calendar-section sync-anchor-section">
    <div class="section-header sync-header" @click="isCollapsed = !isCollapsed">
      <div class="header-left-title">
        <h4 class="m-0"><i class="fas fa-link"></i> Привязка к Календарю Мира</h4>
        <span class="help-icon" title="Связывает летоисчисление этого календаря с глобальным временем мира. Позволяет сравнивать даты и видеть наложение праздников.">[?]</span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-show="!isCollapsed" class="mt-3">
      <!-- Toggle link -->
      <label class="settings-checkbox-label mb-3">
        <input v-model="isLinked" type="checkbox" class="interactive-el">
        <span>Синхронизировать с Календарем Мира (Master Timeline)</span>
      </label>

      <div v-if="isLinked" class="sync-simple-wrapper">
        <div class="sync-year-statement">
          <span class="sync-text">1-й год этого календаря соответствует году</span>
          <input
            v-model.number="masterStartYear"
            type="number"
            class="interactive-el glass-input sync-year-input"
            placeholder="1"
          />
          <span class="sync-text">в Календаре Мира.</span>
        </div>

        <div class="sync-status-card mt-2">
          <i class="fas fa-check-circle sync-status-icon"></i>
          <div class="sync-status-body">
            <span class="sync-status-title">Синхронизировано</span>
            <span class="sync-status-desc">{{ offsetDescription }}</span>
          </div>
        </div>

        <div class="sync-advanced-toggle mt-2">
          <button
            type="button"
            class="interactive-el sync-toggle-btn"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? '▲ Скрыть точный день/месяц' : '⚙ Уточнить конкретный день и месяц привязки' }}
          </button>
        </div>

        <div v-if="showAdvanced" class="sync-advanced-box mt-2">
          <div class="sync-advanced-grid">
            <div class="calendar-field">
              <label class="glass-label sync-field-label">Месяц в Календаре Мира</label>
              <select v-model.number="masterAnchorDate.month" class="interactive-el glass-select w-full">
                <option v-for="(m, idx) in masterMonths" :key="idx" :value="idx">{{ m.название }}</option>
              </select>
            </div>
            <div class="calendar-field">
              <label class="glass-label sync-field-label">День в Календаре Мира</label>
              <input v-model.number="masterAnchorDate.day" type="number" min="1" :max="masterMaxDays" class="interactive-el glass-input w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarSyncAnchor } from './useCalendarSyncAnchor';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

const props = defineProps<{
  modelValue: CalendarData;
  masterCalendar?: CalendarData | null;
}>();

const {
  isCollapsed,
  isLinked,
  masterMonths,
  masterAnchorDate,
  masterMaxDays,
  masterStartYear,
  showAdvanced,
  offsetDescription,
} = useCalendarSyncAnchor(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarSyncAnchor.css"></style>
