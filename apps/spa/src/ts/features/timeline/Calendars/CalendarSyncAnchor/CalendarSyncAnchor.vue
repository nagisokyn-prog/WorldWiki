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

      <div v-if="isLinked" class="sync-grid-container">
        <div class="sync-card local-card">
          <div class="card-caption">Дата этого календаря</div>
          <div class="grid-3 gap-2">
            <div v-if="localEras.length > 1" class="calendar-field col-span-3">
              <label class="glass-label">Эпоха</label>
              <select v-model.number="localAnchorDate.era_index" class="interactive-el">
                <option v-for="(era, idx) in localEras" :key="idx" :value="idx">{{ era.название }}</option>
              </select>
            </div>
            <div class="calendar-field">
              <label class="glass-label">Год</label>
              <input v-model.number="localAnchorDate.year" type="number" class="interactive-el" style="width: 100%;">
            </div>
            <div class="calendar-field">
              <label class="glass-label">Месяц</label>
              <select v-model.number="localAnchorDate.month" class="interactive-el" style="width: 100%;">
                <option v-for="(m, idx) in localMonths" :key="idx" :value="idx">{{ m.название }}</option>
              </select>
            </div>
            <div class="calendar-field">
              <label class="glass-label">День</label>
              <input v-model.number="localAnchorDate.day" type="number" min="1" :max="localMaxDays" class="interactive-el" style="width: 100%;">
            </div>
          </div>
        </div>

        <div class="sync-divider">
          <span>⟷</span>
        </div>

        <div class="sync-card master-card">
          <div class="card-caption">Соответствует в Календаре Мира</div>
          <div class="grid-3 gap-2">
            <div v-if="masterEras.length > 1" class="calendar-field col-span-3">
              <label class="glass-label">Эпоха Мира</label>
              <select v-model.number="masterAnchorDate.era_index" class="interactive-el">
                <option v-for="(era, idx) in masterEras" :key="idx" :value="idx">{{ era.название }}</option>
              </select>
            </div>
            <div class="calendar-field">
              <label class="glass-label">Год</label>
              <input v-model.number="masterAnchorDate.year" type="number" class="interactive-el" style="width: 100%;">
            </div>
            <div class="calendar-field">
              <label class="glass-label">Месяц</label>
              <select v-model.number="masterAnchorDate.month" class="interactive-el" style="width: 100%;">
                <option v-for="(m, idx) in masterMonths" :key="idx" :value="idx">{{ m.название }}</option>
              </select>
            </div>
            <div class="calendar-field">
              <label class="glass-label">День</label>
              <input v-model.number="masterAnchorDate.day" type="number" min="1" :max="masterMaxDays" class="interactive-el" style="width: 100%;">
            </div>
          </div>
        </div>
      </div>

      <div v-if="isLinked" class="sync-offset-banner mt-3">
        <i class="fas fa-info-circle text-accent"></i>
        <span>{{ offsetDescription }}</span>
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
  localEras,
  localMonths,
  masterEras,
  masterMonths,
  localAnchorDate,
  masterAnchorDate,
  localMaxDays,
  masterMaxDays,
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
