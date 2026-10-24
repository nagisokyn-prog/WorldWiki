<template>
  <div v-if="calData && localDate" :class="['calendar-sync-card', isMaster ? 'is-master pinned-card' : 'glass-panel']">
    <div class="cal-badge-row">
      <span :class="isMaster ? 'badge-master' : 'badge-local'">
        {{ isMaster ? 'Мастер' : 'Культура' }}
      </span>
      <span class="cal-name">{{ calData.название || (isMaster ? 'Календарь Мира' : 'Календарь') }}</span>
      <span v-if="isMaster" class="badge-pinned-tag">Опорная ось</span>
    </div>

    <div class="controls-row">
      <div v-if="calData.эпохи && calData.эпохи.length > 0" class="control-group">
        <label class="control-label">Эпоха</label>
        <select
          :value="localDate.era_index ?? 0"
          class="interactive-el glass-select"
          @change="$emit('era-change', calData, $event)"
        >
          <option
            v-for="(era, eIdx) in calData.эпохи"
            :key="eIdx"
            :value="eIdx"
          >
            {{ era.название || `Эпоха ${eIdx + 1}` }}
          </option>
        </select>
      </div>

      <div class="control-group">
        <label class="control-label">Год</label>
        <input
          :value="localDate.year ?? 1"
          type="number"
          class="interactive-el glass-input"
          @input="$emit('year-change', calData, $event)"
        >
      </div>

      <div class="control-group flex-1">
        <label class="control-label">Месяц</label>
        <select
          :value="localDate.month ?? 0"
          class="interactive-el glass-select"
          @change="$emit('month-change', calData, $event)"
        >
          <option
            v-for="(m, mIdx) in calData.месяцы || []"
            :key="mIdx"
            :value="mIdx"
          >
            {{ m.название }}
          </option>
        </select>
      </div>

      <div class="control-group">
        <label class="control-label">День</label>
        <input
          :value="localDate.day ?? 1"
          type="number"
          min="1"
          class="interactive-el glass-input day-input"
          @input="$emit('day-change', calData, $event)"
        >
      </div>
    </div>

    <div v-if="dateMeta" class="card-meta">
      <div class="meta-row">
        <span v-if="dateMeta.season" class="meta-pill season-pill">
          🌱 {{ dateMeta.season }}
        </span>
        <span
          v-if="dateMeta.holiday"
          class="meta-pill holiday-pill"
        >
          🎉 {{ dateMeta.holiday }}
        </span>
      </div>

      <div
        v-if="dateMeta.moons && dateMeta.moons.length > 0"
        class="moons-row"
      >
        <span
          v-for="(m, mIdx) in dateMeta.moons"
          :key="mIdx"
          class="moon-badge"
          :title="`${m.moon.name}: ${m.name}`"
        >
          {{ m.emoji }} {{ m.moon.name }}: {{ m.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarData, CalendarDate, MoonPhaseResult } from '../../../../../services/Calendars/calendar.types';

defineProps<{
  calData?: CalendarData | null;
  localDate?: CalendarDate['original_input'] | null;
  dateMeta?: {
    season: string;
    holiday: string | null;
    moons: MoonPhaseResult[];
  } | null;
  isMaster?: boolean;
}>();

defineEmits<{
  (e: 'era-change', cal: CalendarData, ev: Event): void;
  (e: 'year-change', cal: CalendarData, ev: Event): void;
  (e: 'month-change', cal: CalendarData, ev: Event): void;
  (e: 'day-change', cal: CalendarData, ev: Event): void;
}>();
</script>
