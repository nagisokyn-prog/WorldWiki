<template>
  <div class="calendar-section calendar-geography-card">
    <div class="geography-section-header" @click="isCollapsed = !isCollapsed">
      <h4 class="m-0">🗺️ География и Часовые пояса</h4>
      <span class="geography-collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="geography-content">
      <!-- 1. Регионы и города планеты -->
      <div>
        <div class="geography-block-title">Регионы и города планеты</div>
        <div v-if="selectedRegions.length > 0" class="geography-chips-wrap">
          <div
            v-for="reg in selectedRegions"
            :key="reg.id"
            class="geography-chip"
          >
            <span class="geography-chip-icon">🏛️</span>
            <span>{{ reg.name }}</span>
            <button
              type="button"
              class="geography-chip-remove interactive-el"
              title="Отвязать регион"
              @click.stop="removeRegion(reg.id)"
            >
              ✕
            </button>
          </div>
        </div>
        <div v-else class="geography-empty-hint">
          Календарь пока не привязан ни к одному региону планеты.
        </div>

        <select
          v-if="unselectedRegions.length > 0"
          class="interactive-el geography-select mt-1"
          @change="addRegion(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = '';"
        >
          <option value="" disabled selected>+ Добавить регион или город планеты...</option>
          <option
            v-for="r in unselectedRegions"
            :key="r.id"
            :value="r.id"
          >
            {{ r.name }}
          </option>
        </select>
      </div>

      <!-- 2. Часовые пояса планеты -->
      <div>
        <div class="geography-block-title">Часовые пояса календаря</div>
        <div v-if="selectedTimezones.length > 0" class="geography-chips-wrap">
          <div
            v-for="tz in selectedTimezones"
            :key="tz.id"
            class="geography-chip"
          >
            <span class="geography-chip-icon">🕒</span>
            <span>{{ tz.name }} ({{ tz.code || 'TZ' }}: {{ tz.base_offset_hours >= 0 ? '+' : '' }}{{ tz.base_offset_hours }}ч)</span>
            <button
              type="button"
              class="geography-chip-remove interactive-el"
              title="Отвязать часовой пояс"
              @click.stop="removeTimezone(tz.id)"
            >
              ✕
            </button>
          </div>
        </div>
        <div v-else class="geography-empty-hint">
          Часовые пояса не выбраны (действует нулевой меридиан планеты).
        </div>

        <select
          v-if="unselectedTimezones.length > 0"
          class="interactive-el geography-select mt-1"
          @change="addTimezone(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = '';"
        >
          <option value="" disabled selected>+ Добавить часовой пояс планеты...</option>
          <option
            v-for="t in unselectedTimezones"
            :key="t.id"
            :value="t.id"
          >
            {{ t.name }} ({{ t.base_offset_hours >= 0 ? '+' : '' }}{{ t.base_offset_hours }}ч)
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarGeography } from './useCalendarGeography';
import type { CalendarGeographyProps, CalendarGeographyEmits } from './CalendarGeography.model';

const props = defineProps<CalendarGeographyProps>();
const emit = defineEmits<CalendarGeographyEmits>();

const {
  isCollapsed,
  selectedRegions,
  unselectedRegions,
  selectedTimezones,
  unselectedTimezones,
  addRegion,
  removeRegion,
  addTimezone,
  removeTimezone
} = useCalendarGeography(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarGeography.css"></style>
