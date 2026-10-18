<template>
  <div class="calendar-section sync-anchor-section">
    <div class="section-header sync-header" @click="isCollapsed = !isCollapsed">
      <div class="header-left-title">
        <h4 class="m-0"><i class="fas fa-link"></i> Привязка к Календарю Мира</h4>
        <span
          class="help-icon"
          title="Связывает летоисчисление этого календаря с глобальным временем мира. Позволяет сравнивать даты и видеть наложение праздников."
        >[?]</span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="mt-3">
      <!-- Настройки сопряжения: Опорная эпоха, направление и смещение в годах -->
      <div class="sync-grid-container mb-3">
        <div class="calendar-field">
          <label class="glass-label sync-field-label">Опорная эпоха в Календаре Мира</label>
          <select
            v-model.number="selectedMasterEraIndex"
            class="interactive-el glass-select w-full"
            @change="updateMasterYearFromState"
          >
            <option :value="-1">🌍 От начала Календаря Мира (Год 1)</option>
            <option v-for="(era, idx) in masterEras" :key="idx" :value="idx">
              🏛️ {{ era.название }} (с {{ era.год_начала }} г.)
            </option>
          </select>
        </div>

        <div class="calendar-field">
          <label class="glass-label sync-field-label">Направление отсчёта</label>
          <div class="sync-direction-toggle">
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                v-model="syncDirection"
                type="radio"
                value="after"
                class="interactive-el"
                @change="updateMasterYearFromState"
              />
              <span>После начала эпохи</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                v-model="syncDirection"
                type="radio"
                value="before"
                class="interactive-el"
                @change="updateMasterYearFromState"
              />
              <span>До начала эпохи</span>
            </label>
          </div>
        </div>

        <div class="calendar-field">
          <label class="glass-label sync-field-label">Смещение (лет)</label>
          <input
            v-model.number="offsetYears"
            type="number"
            min="0"
            class="interactive-el glass-input sync-year-input w-full"
            placeholder="0"
            @input="updateMasterYearFromState"
          />
        </div>
      </div>

      <!-- Конкретный день и месяц в Календаре Мира -->
      <div class="sync-date-row mb-3">
        <div class="calendar-field">
          <label class="glass-label sync-field-label">Месяц в Календаре Мира</label>
          <select v-model.number="masterAnchorDate.month" class="interactive-el glass-select w-full">
            <option v-for="(m, idx) in masterMonths" :key="idx" :value="idx">
              {{ m.название }}
            </option>
          </select>
        </div>
        <div class="calendar-field">
          <label class="glass-label sync-field-label">День в Календаре Мира</label>
          <input
            v-model.number="masterAnchorDate.day"
            type="number"
            min="1"
            :max="masterMaxDays"
            class="interactive-el glass-input w-full"
          />
        </div>
      </div>

      <!-- Карточка статуса сопряжения -->
      <div class="sync-status-card">
        <i class="fas fa-check-circle sync-status-icon"></i>
        <div class="sync-status-body">
          <span class="sync-status-title">Синхронизировано с Календарем Мира</span>
          <span class="sync-status-desc">{{ offsetDescription }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarSyncAnchor } from './useCalendarSyncAnchor';
import type { CalendarSyncAnchorProps } from './CalendarSyncAnchor.model';

const props = defineProps<CalendarSyncAnchorProps>();

const {
  isCollapsed,
  masterEras,
  masterMonths,
  masterAnchorDate,
  masterMaxDays,
  selectedMasterEraIndex,
  syncDirection,
  offsetYears,
  updateMasterYearFromState,
  offsetDescription,
} = useCalendarSyncAnchor(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarSyncAnchor.css"></style>
