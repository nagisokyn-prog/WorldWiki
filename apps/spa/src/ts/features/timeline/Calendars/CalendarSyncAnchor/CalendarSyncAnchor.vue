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
        <div class="sync-year-statement" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: var(--bg-hover); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color);">
          <span style="font-size: 13px; color: var(--text-main);">1-й год этого календаря соответствует году</span>
          <input
            v-model.number="masterStartYear"
            type="number"
            class="interactive-el glass-input"
            style="width: 100px; text-align: center; font-weight: bold; color: var(--accent);"
            placeholder="1"
          />
          <span style="font-size: 13px; color: var(--text-main);">в Календаре Мира.</span>
        </div>

        <div class="sync-status-card mt-2" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color);">
          <i class="fas fa-check-circle" style="color: var(--accent); margin-top: 2px;"></i>
          <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
            <span style="font-weight: 600; color: var(--accent); display: block; margin-bottom: 2px;">Синхронизировано</span>
            <span style="color: var(--text-muted);">{{ offsetDescription }}</span>
          </div>
        </div>

        <div class="sync-advanced-toggle mt-2">
          <button
            type="button"
            class="interactive-el"
            style="background: transparent; border: none; font-size: 11px; color: var(--text-muted); cursor: pointer; text-decoration: underline; padding: 0;"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? '▲ Скрыть точный день/месяц' : '⚙ Уточнить конкретный день и месяц привязки' }}
          </button>
        </div>

        <div v-if="showAdvanced" class="sync-advanced-box mt-2" style="background: var(--bg-input); padding: 10px; border-radius: 6px; border: 1px dashed var(--border-color);">
          <div class="grid-2 gap-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="calendar-field">
              <label class="glass-label" style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Месяц в Календаре Мира</label>
              <select v-model.number="masterAnchorDate.month" class="interactive-el glass-select" style="width: 100%;">
                <option v-for="(m, idx) in masterMonths" :key="idx" :value="idx">{{ m.название }}</option>
              </select>
            </div>
            <div class="calendar-field">
              <label class="glass-label" style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">День в Календаре Мира</label>
              <input v-model.number="masterAnchorDate.day" type="number" min="1" :max="masterMaxDays" class="interactive-el glass-input" style="width: 100%;" />
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

<style scoped>
.sync-anchor-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 8px);
  padding: 12px;
  margin-top: 10px;
}

.sync-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.header-left-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-icon {
  font-size: 11px;
  color: var(--text-muted);
  cursor: help;
}

.sync-grid-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
}

@media (max-width: 768px) {
  .sync-grid-container {
    grid-template-columns: 1fr;
  }
}

.sync-card {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  padding: 10px;
}

.card-caption {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sync-divider {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  color: var(--text-muted);
}

.sync-offset-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-selected);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-sm, 6px);
  font-size: 12px;
  color: var(--text-main);
}

.sync-card select,
.sync-card input {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs, 4px);
  color: var(--text-main);
  padding: 4px 8px;
  font-size: 12px;
  outline: none;
}

.sync-card select:focus,
.sync-card input:focus {
  border-color: var(--accent);
}

.col-span-3 {
  grid-column: span 3;
}
</style>
