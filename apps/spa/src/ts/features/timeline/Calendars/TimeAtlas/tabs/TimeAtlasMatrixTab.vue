<template>
  <div class="tab-pane">
    <div class="matrix-toolbar glass-panel">
      <div class="matrix-selector-group">
        <label>Базовый календарь (сетка):</label>
        <select
          :value="matrixBaseCalId"
          class="interactive-el glass-select"
          @change="$emit('update:matrixBaseCalId', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="c in allCalendars" :key="c.id" :value="c.id">
            {{ c.data?.название }}
          </option>
        </select>
      </div>

      <div class="matrix-selector-group">
        <label>Сравнительный (в углах ячеек):</label>
        <select
          :value="matrixCompareCalId"
          class="interactive-el glass-select"
          @change="$emit('update:matrixCompareCalId', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="c in allCalendars" :key="c.id" :value="c.id">
            {{ c.data?.название }}
          </option>
        </select>
      </div>

      <div class="matrix-nav-group">
        <button class="matrix-btn interactive-el" @click="$emit('prevMonth')">◀</button>
        <span class="matrix-cur-month">
          {{ matrixBaseCal?.месяцы?.[matrixMonth]?.название }} {{ matrixYear }} г.
        </span>
        <button class="matrix-btn interactive-el" @click="$emit('nextMonth')">▶</button>
      </div>
    </div>

    <!-- Сетка дней -->
    <div class="matrix-grid">
      <div
        v-for="d in matrixGridDays"
        :key="d.day"
        class="matrix-day-cell interactive-el"
        :class="{
          'is-active': d.isCurrent,
          'has-holiday': d.baseMeta?.holiday || d.compHoliday
        }"
        @click="$emit('selectDay', d.baseMin)"
      >
        <div class="cell-top">
          <span class="base-day-num">{{ d.day }}</span>
          <span v-if="d.compDateStr" class="comp-day-tag" :title="`В сравнительном календаре: ${d.compDateStr}`">
            {{ d.compDateStr }}
          </span>
        </div>

        <div class="cell-body">
          <div v-if="d.baseMeta?.holiday" class="cell-holiday-tag base-holiday" :title="`Праздник: ${d.baseMeta.holiday}`">
            {{ d.baseMeta.holiday }}
          </div>
          <div v-if="d.compHoliday" class="cell-holiday-tag comp-holiday" :title="`Праздник (соседний календарь): ${d.compHoliday}`">
            ⚡ {{ d.compHoliday }}
          </div>
        </div>

        <div v-if="d.baseMeta?.moons?.length > 0" class="cell-moons">
          <span v-for="(m, mIdx) in d.baseMeta.moons" :key="mIdx" :title="`${m.moon.name}: ${m.name}`">
            {{ m.emoji }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarRecord } from '../../../../../stores/calendar.store';
import type { CalendarData } from '../../../../../services/Calendars/calendar.types';

defineProps<{
  allCalendars: CalendarRecord[];
  matrixBaseCalId: string;
  matrixCompareCalId: string;
  matrixYear: number;
  matrixMonth: number;
  matrixBaseCal: CalendarData | null;
  matrixGridDays: Array<{
    day: number;
    baseMin: number;
    isCurrent: boolean;
    compDateStr?: string;
    baseMeta: { holiday?: string | null; moons: Array<{ emoji: string; moon: { name: string }; name: string }> };
    compHoliday?: string | null;
  }>;
}>();

defineEmits<{
  (e: 'update:matrixBaseCalId', value: string): void;
  (e: 'update:matrixCompareCalId', value: string): void;
  (e: 'prevMonth'): void;
  (e: 'nextMonth'): void;
  (e: 'selectDay', baseMin: number): void;
}>();
</script>
