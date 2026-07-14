<template>
  <div class="calendar-section interactive-el playground-section">
    <div class="section-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
      <h4 style="color: var(--accent); margin: 0;"><i class="fas fa-flask"></i> Тестовый полигон (Playground)</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <p class="glass-label" style="font-size: 11px; margin-bottom: 12px;">
        Введи любую дату, чтобы проверить математику календаря: день недели, високосность, фазы лун и погоду.
      </p>

      <div class="playground-inputs" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
        <div class="calendar-field" style="width: 140px;">
          <label>Эпоха</label>
          <select v-model.number="testDate.era_index" class="interactive-el">
            <option v-for="(era, idx) in calendar.эпохи" :key="idx" :value="idx">{{ era.название }}</option>
          </select>
        </div>
        <div class="calendar-field" style="width: 80px;">
          <label>Год</label>
          <input type="number" v-model.number="testDate.year" class="interactive-el">
        </div>
        <div class="calendar-field" style="width: 120px;">
          <label>Месяц</label>
          <select v-model.number="testDate.month" class="interactive-el">
            <option v-for="(m, idx) in calendar.месяцы" :key="idx" :value="idx">{{ m.название }}</option>
          </select>
        </div>
        <div class="calendar-field" style="width: 70px;">
          <label>День</label>
          <input type="number" v-model.number="testDate.day" min="1" class="interactive-el">
        </div>
      </div>

      <div class="playground-results" v-if="results">
        <div class="result-card">
          <div class="r-title">🔢 Absolute Minute</div>
          <div class="r-value" style="font-family: monospace;">{{ results.absoluteMinute.toLocaleString() }}</div>
        </div>
        
        <div class="result-card">
          <div class="r-title">📅 День недели</div>
          <div class="r-value" style="color: var(--accent);">{{ results.weekdayName }}</div>
        </div>
        
        <div class="result-card">
          <div class="r-title">❄️ Сезон</div>
          <div class="r-value">{{ results.seasonName }}</div>
        </div>

        <div class="result-card" v-if="results.weather">
          <div class="r-title">🌦️ Погода</div>
          <div class="r-value" style="font-size: 12px;">
            {{ results.weather.temp_min }}..{{ results.weather.temp_max }}°C<br>
            <span style="color: #3498db;">{{ results.weather.precipitation }}</span>
          </div>
        </div>

        <div class="result-card" v-if="results.isHoliday" style="border-color: #f1c40f; background: rgba(241, 196, 15, 0.1);">
          <div class="r-title">🎉 Праздник!</div>
          <div class="r-value" style="color: #f1c40f;">Да</div>
        </div>
        
        <div class="result-card" v-if="results.isLeapYear" style="border-color: #2ecc71; background: rgba(46, 204, 113, 0.1);">
          <div class="r-title">🐸 Високосный</div>
          <div class="r-value" style="color: #2ecc71;">Да</div>
        </div>

        <template v-if="results.moons && results.moons.length > 0">
          <div class="result-card" v-for="moon in results.moons" :key="moon.moon.name">
            <div class="r-title">🌙 {{ moon.moon.name }}</div>
            <div class="r-value" :title="'Фаза: ' + moon.phase.toFixed(2)">
              {{ moon.emoji }} {{ moon.name }}<br>
              <span style="font-size: 10px; color: var(--text-muted);">День {{ moon.dayInCycle.toFixed(1) }}</span>
            </div>
          </div>
        </template>
        
        <div class="result-card" v-if="results.daylight" style="flex-basis: 100%;">
          <div class="r-title">🌞 Световой день ({{ results.daylight.duration_hours }} ч.)</div>
          <div class="r-value" style="display: flex; gap: 16px; font-size: 13px;">
            <span style="color: #f39c12;">Рассвет: {{ results.daylight.sunrise }}</span>
            <span style="color: #e74c3c;">Зенит: {{ results.daylight.zenith }}</span>
            <span style="color: #9b59b6;">Закат: {{ results.daylight.sunset }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CalendarMath } from '../../../services/calendar.math';
import { calendarService } from '../../../services/calendar.service';
import { CalendarData } from '../../../services/Calendars/calendar.types';

const props = defineProps<{
  calendar: CalendarData;
}>();

const isCollapsed = ref(false);

const testDate = ref({
  era_index: 1, // Assuming Našaja Era
  year: 1,
  month: 0,
  day: 1
});

// Initialize era index if it doesn't match
watch(() => props.calendar.эпохи, (eras) => {
  if (eras && eras.length > 0 && testDate.value.era_index >= eras.length) {
    testDate.value.era_index = 0;
  }
}, { immediate: true });

const results = computed(() => {
  const cal = props.calendar;
  if (!cal || !cal.месяцы || cal.месяцы.length === 0) return null;
  
  try {
    const inputDate = { ...testDate.value, hour: 12, minute: 0 };
    
    // 1. Calculate Absolute Minute
    const absoluteMinute = CalendarMath.getAbsoluteMinute(inputDate, cal);
    
    // 2. Day of Week
    const daysInWeek = cal.дней_в_неделе || 7;
    const settings = cal.настройки_времени;
    const minutesInDay = (settings?.часов_в_сутках || 24) * (settings?.минут_в_часе || 60);
    const absoluteDay = Math.floor(absoluteMinute / minutesInDay);
    
    // Optional: offset if year 1 started not on first day of week. (Simplifying for now).
    const startOffset = cal.точка_отсчета?.день_недели || 0;
    const weekdayIdx = ((absoluteDay + startOffset) % daysInWeek + daysInWeek) % daysInWeek;
    
    const weekdayName = cal.названия_дней_недели?.[weekdayIdx] || `День ${weekdayIdx + 1}`;
    
    // 3. Season & Weather
    const seasonName = calendarService.getSeasonForDate(cal, inputDate.year, inputDate.month);
    let weather = null;
    if (cal.сезоны && cal.weather_patterns) {
      const seasonIndex = cal.сезоны.findIndex((s: any) => s.название === seasonName);
      if (seasonIndex !== -1) {
        weather = cal.weather_patterns.find((w: any) => w.season_index === seasonIndex);
      }
    }
    
    // 4. Leap Year & Holiday
    const isLeapYear = CalendarMath.isLeapYear(cal, inputDate.year);
    const isHoliday = calendarService.isHoliday(cal, inputDate.year, inputDate.month, inputDate.day);
    
    // 5. Moons
    const moons = CalendarMath.calculateMoonPhases(absoluteMinute, cal.moons || [], cal);
    
    // 6. Daylight
    const daylight = CalendarMath.calculateDaylight(absoluteMinute, cal);
    
    return {
      absoluteMinute,
      weekdayName,
      seasonName,
      weather,
      isLeapYear,
      isHoliday,
      moons,
      daylight
    };
  } catch (e) {
    console.error("Playground calc error:", e);
    return null;
  }
});
</script>

<style scoped>
.playground-section {
  background: rgba(139, 92, 246, 0.05) !important;
  border-color: rgba(139, 92, 246, 0.3) !important;
}
.calendar-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.calendar-field label {
  font-size: 11px;
  color: var(--text-muted);
}
.calendar-field select, .calendar-field input {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 6px;
  border-radius: 4px;
}
.playground-results {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  background: rgba(0, 0, 0, 0.2);
  padding: 16px;
  border-radius: 8px;
  border: 1px inset rgba(255, 255, 255, 0.05);
}
.result-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  min-width: 120px;
}
.r-title {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.r-value {
  font-size: 14px;
  font-weight: bold;
}
</style>
