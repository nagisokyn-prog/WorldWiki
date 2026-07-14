<template>
  <div class="calendar-section interactive-el playground-section" style="width: 100%;">
    <div class="section-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
      <h4 style="color: var(--accent); margin: 0;"><i class="fas fa-calendar-alt"></i> Точка отсчёта в произведении</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 16px;">
      
      <!-- Controls -->
      <div class="playground-controls">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <!-- Era -->
          <select v-model.number="testDate.era_index" class="interactive-el glass-select" v-if="calendar.эпохи && calendar.эпохи.length > 0">
            <option v-for="(era, idx) in calendar.эпохи" :key="idx" :value="idx">{{ era.название }}</option>
          </select>
          
          <!-- Year -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 11px; color: var(--text-muted);">Год:</label>
            <input type="number" v-model.number="testDate.year" class="interactive-el glass-input" style="width: 70px;">
          </div>
          
          <!-- Month Nav -->
          <div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 4px;">
            <button class="btn-icon interactive-el" @click="prevMonth" title="Предыдущий месяц">◀</button>
            <select v-model.number="testDate.month" class="interactive-el glass-select" style="min-width: 120px;">
              <option v-for="(m, idx) in calendar.месяцы" :key="idx" :value="idx">{{ m.название }}</option>
            </select>
            <button class="btn-icon interactive-el" @click="nextMonth" title="Следующий месяц">▶</button>
          </div>
        </div>
        
        <div class="filters">
          <label class="filter-label"><input type="checkbox" v-model="filters.seasons"> Сезоны</label>
          <label class="filter-label"><input type="checkbox" v-model="filters.moons"> Луны</label>
          <label class="filter-label"><input type="checkbox" v-model="filters.holidays"> Праздники</label>
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-wrapper">
        <div class="calendar-grid" :style="{ gridTemplateColumns: `repeat(${daysInWeek}, 1fr)` }">
          <!-- Weekdays Header -->
          <div v-for="(dayName, idx) in weekdayNames" :key="'w'+idx" class="weekday-header">
            {{ dayName.slice(0, 3) }}
          </div>
          
          <!-- Empty slots for offset -->
          <div v-for="empty in startWeekdayOffset" :key="'e'+empty" class="day-cell empty-cell"></div>
          
          <!-- Actual Days -->
          <div v-for="day in gridDays" :key="'d'+day.day" 
               class="day-cell" 
               :class="{ 'is-holiday': day.holidayText, 'is-origin': day.isOrigin }"
               :style="{ backgroundColor: filters.seasons ? day.seasonColor : 'transparent' }"
               :title="getDayTooltip(day)">
            
            <div class="day-number">{{ day.day }}</div>
            
            <div class="day-content">
              <!-- Origin Marker -->
              <div v-if="day.isOrigin" class="origin-marker" title="Точка отсчета (День 0)">🌟</div>
              
              <!-- Holiday Text -->
              <div v-if="day.holidayText && filters.holidays" class="holiday-text">
                {{ day.holidayText }}
              </div>
            </div>

            <!-- Moons Overlay -->
            <div class="moons-container" v-if="filters.moons && day.moons.length">
              <template v-for="m in day.moons" :key="m.moon.name">
                <div class="moon-dot" 
                     v-if="isSignificantPhase(m.phase)" 
                     :style="{ backgroundColor: m.moon.color || '#fff' }"
                     :title="`${m.emoji} ${m.moon.name}: ${m.name}`">
                </div>
              </template>
            </div>
            
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CalendarMath } from '../../../services/Calendars/calendar.math';
import { CalendarData } from '../../../services/Calendars/calendar.types';

const props = defineProps<{
  calendar: CalendarData;
}>();

const isCollapsed = ref(false);

const testDate = ref({
  era_index: 0,
  year: 1,
  month: 0
});

const filters = ref({
  seasons: true,
  moons: true,
  holidays: true
});

watch(() => props.calendar, (cal) => {
  if (cal && cal.точка_отсчета) {
    if (testDate.value.year === 1 && testDate.value.month === 0) {
      testDate.value.year = cal.точка_отсчета.год || 1;
      testDate.value.month = cal.точка_отсчета.месяц || 0;
    }
  }
}, { immediate: true });

const daysInWeek = computed(() => props.calendar.дней_в_неделе || 7);
const weekdayNames = computed(() => {
  const names = props.calendar.названия_дней_недели || [];
  return Array.from({ length: daysInWeek.value }).map((_, i) => names[i] || `День ${i + 1}`);
});

const prevMonth = () => {
  if (testDate.value.month > 0) {
    testDate.value.month--;
  } else {
    testDate.value.month = (props.calendar.месяцы?.length || 1) - 1;
    testDate.value.year--;
  }
};

const nextMonth = () => {
  if (testDate.value.month < (props.calendar.месяцы?.length || 1) - 1) {
    testDate.value.month++;
  } else {
    testDate.value.month = 0;
    testDate.value.year++;
  }
};

const currentDaysCount = computed(() => {
  return CalendarMath.getDaysInMonth(props.calendar, testDate.value.year, testDate.value.month);
});

const startWeekdayOffset = computed(() => {
  const inputDate = { ...testDate.value, day: 1, hour: 12, minute: 0 };
  const absMinute = CalendarMath.getAbsoluteMinute(inputDate, props.calendar);
  const settings = props.calendar.настройки_времени;
  const minutesInDay = (settings?.часов_в_сутках || 24) * (settings?.минут_в_часе || 60);
  const absoluteDay = Math.floor(absMinute / minutesInDay);
  
  const startOffset = props.calendar.точка_отсчета?.день_недели || 0;
  return ((absoluteDay + startOffset) % daysInWeek.value + daysInWeek.value) % daysInWeek.value;
});

const getHolidayForDate = (cal: CalendarData, year: number, monthIdx: number, day: number) => {
  if (!cal || !cal.праздники) return null;
  for (const h of cal.праздники) {
    const sm = h.дата_начала.месяц, sd = h.дата_начала.день;
    const em = h.дата_конца?.месяц ?? sm, ed = h.дата_конца?.день ?? sd;
    if (monthIdx >= sm && monthIdx <= em) {
      if (monthIdx === sm && monthIdx === em && day >= sd && day <= ed) return h;
      if (monthIdx === sm && day >= sd) return h;
      if (monthIdx === em && day <= ed) return h;
      if (monthIdx > sm && monthIdx < em) return h;
    }
  }
  return null;
};

// Check if phase is New Moon (0/1) or Full Moon (0.5) roughly.
const isSignificantPhase = (phase: number) => {
  return phase < 0.05 || phase > 0.95 || Math.abs(phase - 0.5) < 0.05;
};

// Fallback season colors if user didn't specify
const seasonColorsMap: Record<string, string> = {
  'Зима': 'rgba(100, 150, 255, 0.1)',
  'Весна': 'rgba(100, 255, 150, 0.1)',
  'Лето': 'rgba(255, 200, 100, 0.1)',
  'Осень': 'rgba(255, 150, 50, 0.1)',
};

const gridDays = computed(() => {
  const days = [];
  const count = currentDaysCount.value;
  const cal = props.calendar;
  
  for (let i = 1; i <= count; i++) {
    const inputDate = { ...testDate.value, day: i, hour: 12, minute: 0 };
    const absMinute = CalendarMath.getAbsoluteMinute(inputDate, cal);
    
    // Moon phases for the day
    let moons: any[] = [];
    if (filters.value.moons) {
      moons = CalendarMath.calculateMoonPhases(absMinute, cal.moons || [], cal);
    }

    // Season
    let seasonColor = 'transparent';
    let seasonName = '';
    if (filters.value.seasons) {
      seasonName = CalendarMath.getSeasonForDate(cal, inputDate.year, inputDate.month);
      // For now we assume season component might not have color property yet, we use a fallback map or a default tint.
      seasonColor = seasonColorsMap[seasonName] || 'rgba(255,255,255,0.03)';
    }

    // Holidays
    let holiday = null;
    if (filters.value.holidays) {
       holiday = getHolidayForDate(cal, inputDate.year, inputDate.month, i);
    }
    
    // Origin
    const isOrigin = (cal.точка_отсчета?.год === inputDate.year && cal.точка_отсчета?.месяц === inputDate.month && cal.точка_отсчета?.день === i);

    days.push({
      day: i,
      absMinute,
      moons,
      seasonName,
      seasonColor,
      holidayText: holiday ? holiday.название : '',
      isOrigin
    });
  }
  return days;
});

const getDayTooltip = (day: any) => {
  let lines = [`День ${day.day}`];
  if (day.seasonName && filters.value.seasons) lines.push(`❄️ ${day.seasonName}`);
  if (day.holidayText && filters.value.holidays) lines.push(`🎉 Праздник: ${day.holidayText}`);
  if (day.moons && day.moons.length && filters.value.moons) {
    day.moons.forEach((m: any) => {
      lines.push(`${m.emoji} ${m.moon.name}: ${m.name}`);
    });
  }
  if (day.isOrigin) lines.push(`🌟 Точка отсчета (День 0)`);
  return lines.join('\n');
};
</script>

<style scoped>
.playground-section {
  background: rgba(0, 0, 0, 0.2) !important;
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: 12px;
}
.playground-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
  background: var(--bg-input);
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px inset rgba(255,255,255,0.05);
}
.glass-select, .glass-input {
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 6px 12px;
  border-radius: 6px;
}
.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.btn-icon:hover {
  background: rgba(255,255,255,0.1);
}
.filters {
  display: flex;
  gap: 12px;
}
.filter-label {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}
.calendar-wrapper {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}
.calendar-grid {
  display: grid;
  border-top: 1px solid rgba(255,255,255,0.05);
  border-left: 1px solid rgba(255,255,255,0.05);
}
.weekday-header {
  padding: 8px;
  text-align: center;
  font-size: 11px;
  font-weight: bold;
  color: var(--text-muted);
  text-transform: uppercase;
  background: rgba(0,0,0,0.3);
  border-right: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.day-cell {
  position: relative;
  min-height: 80px;
  padding: 8px;
  border-right: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
}
.day-cell:hover:not(.empty-cell) {
  background: rgba(255,255,255,0.05) !important;
}
.empty-cell {
  background: rgba(0,0,0,0.1);
}
.day-number {
  font-size: 14px;
  font-weight: bold;
  opacity: 0.8;
  margin-bottom: 4px;
}
.is-holiday {
  box-shadow: inset 0 0 0 1px rgba(241, 196, 15, 0.3);
}
.is-origin {
  box-shadow: inset 0 0 0 1px var(--accent-glow);
}
.origin-marker {
  font-size: 16px;
  align-self: flex-start;
  line-height: 1;
  text-shadow: 0 0 10px rgba(255,255,255,0.5);
}
.holiday-text {
  font-size: 10px;
  color: #f1c40f;
  background: rgba(241, 196, 15, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  margin-top: auto;
  line-height: 1.2;
  word-break: break-word;
}
.moons-container {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
}
.moon-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
}
</style>
