<template>
  <div class="calendar-settings-section">
    <h4><i class="fas fa-globe"></i> Часовые пояса и География Мира</h4>
    <p class="help-text timezone-help-text">
      Часовые пояса и регионы принадлежат физической планете (долготе на карте мира). Настройте сетку поясов и добавьте ключевые регионы, чтобы легко переключать местное время в сценах и Атласе Времени.
    </p>

    <!-- Секция 1: Часовые пояса мира -->
    <div class="tz-sub-header">
      <span class="tz-sub-title">1. Часовые пояса планеты</span>
      <button type="button" class="btn-new btn-outline-new btn-sm interactive-el" @click="addTimezone">
        + Добавить пояс
      </button>
    </div>

    <div class="moons-list mb-3">
      <div v-for="(tz, idx) in timezones" :key="tz.id" class="moon-item glass-panel tz-item-card">
        <div class="grid-3">
          <div class="calendar-field">
            <label>Название пояса</label>
            <input v-model="tz.name" type="text" class="interactive-el" placeholder="Столичный меридиан" @input="updateParent">
          </div>
          <div class="calendar-field">
            <label>Код зоны</label>
            <input v-model="tz.code" type="text" class="interactive-el" placeholder="CAP" @input="updateParent">
          </div>
          <div class="calendar-field">
            <label>Смещение от меридиана (ч)</label>
            <input v-model.number="tz.base_offset_hours" type="number" step="0.5" class="interactive-el" placeholder="+3.0" @input="updateParent">
          </div>
        </div>
        <button type="button" class="btn-delete-tz" @click="removeTimezone(idx)">Удалить пояс</button>
      </div>

      <div v-if="timezones.length === 0" class="tz-empty-hint">
        Нет часовых поясов. Нажмите «+ Добавить пояс», чтобы создать нулевой меридиан или региональные пояса.
      </div>
    </div>

    <!-- Секция 2: Географические регионы и города -->
    <div class="tz-sub-header mt-3">
      <span class="tz-sub-title">2. Регионы и города мира</span>
      <button type="button" class="btn-new btn-outline-new btn-sm interactive-el" @click="addRegion">
        + Добавить регион
      </button>
    </div>

    <div class="moons-list">
      <div v-for="(reg, rIdx) in regions" :key="reg.id" class="moon-item glass-panel tz-item-card">
        <div class="grid-4">
          <div class="calendar-field">
            <label>Название региона / города</label>
            <input v-model="reg.name" type="text" class="interactive-el" placeholder="Столица Империи" @input="updateParent">
          </div>
          <div class="calendar-field">
            <label>Часовой пояс</label>
            <select v-model="reg.timezone_id" class="interactive-el" @change="updateParent">
              <option value="" disabled>Выберите пояс</option>
              <option v-for="t in timezones" :key="t.id" :value="t.id">
                {{ t.name }} ({{ t.base_offset_hours >= 0 ? '+' : '' }}{{ t.base_offset_hours }} ч)
              </option>
            </select>
          </div>
          <div class="calendar-field">
            <label>Широта (сезоны / день)</label>
            <input v-model.number="reg.latitude" type="number" step="1" min="-90" max="90" class="interactive-el" placeholder="45.0" @input="updateParent">
          </div>
          <div class="calendar-field">
            <label>Долгота (зенит солнца)</label>
            <input v-model.number="reg.longitude" type="number" step="1" min="-180" max="180" class="interactive-el" placeholder="0.0" @input="updateParent">
          </div>
        </div>
        <div class="grid-2 mt-2">
          <div class="calendar-field">
            <label class="glass-label label-summer">☀️ Макс. световой день (лето)</label>
            <div class="daylight-fraction-group">
              <div class="daylight-input-unit">
                <input
                  :value="getSummerHours(reg)"
                  type="number"
                  min="0"
                  :max="hoursInDay"
                  class="interactive-el daylight-hours-input"
                  placeholder="16"
                  @input="setSummerHours(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="daylight-unit-label">ч</span>
              </div>
              <div class="daylight-fraction-unit">
                <input
                  :value="getSummerMinutes(reg)"
                  type="number"
                  min="0"
                  :max="minsInHour - 1"
                  class="interactive-el daylight-mins-input"
                  placeholder="0"
                  @input="setSummerMinutes(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="daylight-fraction-divider">/</span>
                <span class="daylight-denom-label">{{ minsInHour }} мин</span>
              </div>
            </div>
          </div>
          <div class="calendar-field">
            <label class="glass-label label-winter">❄️ Мин. световой день (зима)</label>
            <div class="daylight-fraction-group">
              <div class="daylight-input-unit">
                <input
                  :value="getWinterHours(reg)"
                  type="number"
                  min="0"
                  :max="hoursInDay"
                  class="interactive-el daylight-hours-input"
                  placeholder="8"
                  @input="setWinterHours(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="daylight-unit-label">ч</span>
              </div>
              <div class="daylight-fraction-unit">
                <input
                  :value="getWinterMinutes(reg)"
                  type="number"
                  min="0"
                  :max="minsInHour - 1"
                  class="interactive-el daylight-mins-input"
                  placeholder="0"
                  @input="setWinterMinutes(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="daylight-fraction-divider">/</span>
                <span class="daylight-denom-label">{{ minsInHour }} мин</span>
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="btn-delete-tz mt-2" @click="removeRegion(rIdx)">Удалить регион</button>
      </div>

      <div v-if="regions.length === 0" class="tz-empty-hint">
        Нет регионов. Добавьте регионы мира с широтой, долготой и световым днём, чтобы система автоматически рассчитывала восход, закат и местное время.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarTimezones } from './useCalendarTimezones';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

const props = defineProps<{ modelValue: CalendarData }>();
const emit = defineEmits(['update:modelValue']);

const {
  timezones,
  regions,
  addTimezone,
  removeTimezone,
  addRegion,
  removeRegion,
  updateParent,
  minsInHour,
  hoursInDay,
  getSummerHours,
  getSummerMinutes,
  setSummerHours,
  setSummerMinutes,
  getWinterHours,
  getWinterMinutes,
  setWinterHours,
  setWinterMinutes
} = useCalendarTimezones(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarTimezones.css"></style>
