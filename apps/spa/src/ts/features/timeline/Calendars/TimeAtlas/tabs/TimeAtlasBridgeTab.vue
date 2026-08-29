<template>
  <div class="tab-pane">
    <!-- Опорный мастер-календарь -->
    <div v-if="masterCalData" class="master-pinned-section">
      <div class="section-label">
        <i class="fas fa-anchor"></i> Опорное летоисчисление (Календарь Мира)
      </div>
      <div class="calendar-sync-card is-master pinned-card">
        <div class="cal-badge-row">
          <span class="badge-master">Мастер</span>
          <span class="cal-name">{{ masterCalData.название || 'Календарь Мира' }}</span>
          <span class="badge-pinned-tag">Опорная ось</span>
        </div>

        <div class="controls-row">
          <div class="control-group">
            <label class="control-label">Год</label>
            <input
              :value="getLocalDateForCal(masterCalData).year"
              type="number"
              class="interactive-el glass-input"
              @input="onYearChange(masterCalData, $event)"
            >
          </div>

          <div class="control-group flex-1">
            <label class="control-label">Месяц</label>
            <select
              :value="getLocalDateForCal(masterCalData).month"
              class="interactive-el glass-select"
              @change="onMonthChange(masterCalData, $event)"
            >
              <option
                v-for="(m, mIdx) in masterCalData.месяцы || []"
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
              :value="getLocalDateForCal(masterCalData).day"
              type="number"
              min="1"
              class="interactive-el glass-input day-input"
              @input="onDayChange(masterCalData, $event)"
            >
          </div>
        </div>

        <div class="card-meta">
          <div class="meta-row">
            <span class="meta-pill season-pill">
              🌱 {{ getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).season }}
            </span>
            <span
              v-if="getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).holiday"
              class="meta-pill holiday-pill"
            >
              🎉 {{ getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).holiday }}
            </span>
          </div>

          <div
            v-if="getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).moons.length > 0"
            class="moons-row"
          >
            <span
              v-for="(m, mIdx) in getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).moons"
              :key="mIdx"
              class="moon-badge"
              :title="`${m.moon.name}: ${m.name}`"
            >
              {{ m.emoji }} {{ m.moon.name }}: {{ m.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Список локальных летоисчислений культур -->
    <div class="section-label">
      <i class="fas fa-layer-group"></i> Календари культур и рас
    </div>

    <div v-if="localCalsWithData.length === 0" class="no-locals-box glass-panel">
      В проекте пока нет других календарей. Создайте региональный календарь в боковой панели, чтобы сопоставлять его с Календарем Мира.
    </div>

    <div v-else class="converter-grid">
      <div
        v-for="item in localCalsWithData"
        :key="item.id"
        class="calendar-sync-card glass-panel"
      >
        <div class="cal-badge-row">
          <span class="badge-local">Культура</span>
          <span class="cal-name">{{ item.name }}</span>
        </div>

        <div class="controls-row">
          <div class="control-group">
            <label class="control-label">Год</label>
            <input
              :value="getLocalDateForCal(item.data).year"
              type="number"
              class="interactive-el glass-input"
              @input="onYearChange(item.data, $event)"
            >
          </div>

          <div class="control-group flex-1">
            <label class="control-label">Месяц</label>
            <select
              :value="getLocalDateForCal(item.data).month"
              class="interactive-el glass-select"
              @change="onMonthChange(item.data, $event)"
            >
              <option
                v-for="(m, mIdx) in item.data.месяцы || []"
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
              :value="getLocalDateForCal(item.data).day"
              type="number"
              min="1"
              class="interactive-el glass-input day-input"
              @input="onDayChange(item.data, $event)"
            >
          </div>
        </div>

        <div class="card-meta">
          <div class="meta-row">
            <span class="meta-pill season-pill">
              🌱 {{ getDateMeta(item.data, getLocalDateForCal(item.data)).season }}
            </span>
            <span
              v-if="getDateMeta(item.data, getLocalDateForCal(item.data)).holiday"
              class="meta-pill holiday-pill"
            >
              🎉 {{ getDateMeta(item.data, getLocalDateForCal(item.data)).holiday }}
            </span>
          </div>

          <div
            v-if="getDateMeta(item.data, getLocalDateForCal(item.data)).moons.length > 0"
            class="moons-row"
          >
            <span
              v-for="(m, mIdx) in getDateMeta(item.data, getLocalDateForCal(item.data)).moons"
              :key="mIdx"
              class="moon-badge"
              :title="`${m.moon.name}: ${m.name}`"
            >
              {{ m.emoji }} {{ m.moon.name }}: {{ m.name }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarRecord } from '../../../../../stores/calendar.store';
import type { CalendarData, CalendarDate, MoonPhaseResult } from '../../../../../services/Calendars/calendar.types';

const props = defineProps<{
  masterCalendarRecord: CalendarRecord | null;
  localCalendarRecords: CalendarRecord[];
  getLocalDateForCal: (cal: CalendarData) => CalendarDate['original_input'];
  updateFromLocalDate: (cal: CalendarData, localDate: CalendarDate['original_input']) => void;
  getDateMeta: (cal: CalendarData, date: CalendarDate['original_input']) => {
    season: string;
    holiday: string | null;
    moons: MoonPhaseResult[];
  };
}>();

const masterCalData = computed<CalendarData | null>(() => {
  return (props.masterCalendarRecord?.data as CalendarData) || null;
});

const localCalsWithData = computed<Array<{ id: string; name: string; data: CalendarData }>>(() => {
  return props.localCalendarRecords
    .filter(c => !!c.data)
    .map(c => ({
      id: c.id || '',
      name: (c.data as CalendarData).название || 'Календарь',
      data: c.data as CalendarData
    }));
});

const onYearChange = (cal: CalendarData, e: Event) => {
  const input = e.target as HTMLInputElement;
  const current = props.getLocalDateForCal(cal);
  props.updateFromLocalDate(cal, { ...current, year: Number(input.value) });
};

const onMonthChange = (cal: CalendarData, e: Event) => {
  const select = e.target as HTMLSelectElement;
  const current = props.getLocalDateForCal(cal);
  props.updateFromLocalDate(cal, { ...current, month: Number(select.value) });
};

const onDayChange = (cal: CalendarData, e: Event) => {
  const input = e.target as HTMLInputElement;
  const current = props.getLocalDateForCal(cal);
  props.updateFromLocalDate(cal, { ...current, day: Number(input.value) });
};
</script>
