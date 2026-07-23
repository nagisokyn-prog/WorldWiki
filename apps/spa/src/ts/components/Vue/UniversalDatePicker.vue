<template>
  <div v-if="allCalendars.length > 0" class="date-wheels-container" style="display: flex; gap: 8px; align-items: center; background: var(--bg-card, rgba(0,0,0,0.2)); padding: 4px; border-radius: 12px; border: 1px solid var(--border-color); flex-wrap: wrap;">
    
    <!-- Календарь -->
    <div class="date-wheel-group" style="flex: 1.5; min-width: 140px;" v-if="allCalendars.length > 1">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Календарь</div>
      <XboxWheel
        v-model="currentCalendarId"
        :horizontal="wheelHorizontal"
        :options="calendarOptions"
        placeholder="Календарь"
        @update:model-value="onCalendarChange"
      />
    </div>

    <!-- Эпоха -->
    <div v-if="eras.length > 1" class="date-wheel-group" style="flex: 1; min-width: 120px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Эпоха</div>
      <XboxWheel
        v-model="currentEraIdx" 
        :horizontal="wheelHorizontal"
        :options="eraOptions"
        placeholder="Эпоха"
        @update:model-value="onEraChange"
      />
    </div>

    <!-- Год -->
    <div class="date-wheel-group" style="flex: 1; min-width: 90px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Год</div>
      <template v-if="yearInputMode">
        <input 
          v-model.number="currentYear" 
          type="number"
          :min="currentEra.год_начала" 
          :max="currentEra.год_конца"
          class="input-base"
          style="text-align: center; height: 44px; padding: 0; box-sizing: border-box;"
          @change="onYearChange"
        />
      </template>
      <template v-else>
        <XboxWheel
          v-model="currentYear" 
          :horizontal="wheelHorizontal"
          :options="yearOptions"
          placeholder="Год"
          @update:model-value="onYearChange"
        />
      </template>
    </div>

    <!-- Месяц -->
    <div class="date-wheel-group" style="flex: 1.5; min-width: 140px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Месяц</div>
      <XboxWheel
        v-model="currentMonthIdx" 
        :horizontal="wheelHorizontal"
        :options="monthOptions"
        placeholder="Месяц"
        @update:model-value="onMonthChange"
      />
    </div>

    <!-- День -->
    <div class="date-wheel-group" style="flex: 0.8; min-width: 70px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">День</div>
      <XboxWheel
        v-model="currentDay" 
        :horizontal="wheelHorizontal"
        :options="dayOptions"
        placeholder="День"
        @update:model-value="onDayChange"
      />
    </div>

    <!-- Время (Опционально) -->
    <template v-if="showTime">
      <!-- Час -->
      <div class="date-wheel-group" style="flex: 0.8; min-width: 70px;">
        <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Час</div>
        <XboxWheel
          v-model="currentHour" 
          :horizontal="wheelHorizontal"
          :options="hourOptions"
          placeholder="Час"
          @update:model-value="onTimeChange"
        />
      </div>

      <div style="display:flex; align-items:flex-end; padding-bottom:12px; font-weight:bold;">:</div>

      <!-- Минута -->
      <div class="date-wheel-group" style="flex: 0.8; min-width: 70px;">
        <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Мин</div>
        <XboxWheel
          v-model="currentMinute" 
          :horizontal="wheelHorizontal"
          :options="minuteOptions"
          placeholder="Мин"
          @update:model-value="onTimeChange"
        />
      </div>
    </template>

  </div>
  <div v-else style="padding: 10px; color: var(--text-muted); font-size: 12px;">Загрузка календарей...</div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

import { calendarService } from '../../services/calendar.service';
import { CalendarMath } from '../../services/Calendars/calendar.math';
import { XboxWheel, settingsService } from '@worldwiki/components';

const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => null
  },
  project: {
    type: String,
    required: true
  },
  showTime: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const allCalendars = ref([]);

const currentCalendarId = ref('');
const currentEraIdx = ref(0);
const currentYear = ref(1);
const currentMonthIdx = ref(0);
const currentDay = ref(1);
const currentHour = ref(12);
const currentMinute = ref(0);

const calendar = computed(() => {
  if (!currentCalendarId.value) return null;
  const calObj = allCalendars.value.find(c => c.id === currentCalendarId.value);
  return calObj ? (calObj.data || calObj) : null;
});

const calendarOptions = computed(() => {
  return allCalendars.value.map(c => ({
    value: c.id,
    label: (c.data || c).название || 'Календарь'
  }));
});

const eras = computed(() => calendar.value?.эпохи || []);
const months = computed(() => calendar.value?.месяцы || []);

const currentEra = computed(() => eras.value[currentEraIdx.value] || eras.value[0] || { год_начала: 1, год_конца: 9999, название: '' });

const yearRange = computed(() => currentEra.value.год_конца - currentEra.value.год_начала);
const yearInputMode = computed(() => yearRange.value > 500);

const hasTimeSettings = computed(() => !!calendar.value?.настройки_времени);
const timeSettings = computed(() => calendar.value?.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 });

const eraOptions = computed(() => {
  return eras.value.map((e, i) => ({ value: i, label: e.название || `Эпоха ${i+1}` }));
});

const yearOptions = computed(() => {
  if (yearInputMode.value) return [];
  const opts = [];
  for (let i = currentEra.value.год_начала; i <= currentEra.value.год_конца; i++) {
    opts.push({ value: i, label: String(i) });
  }
  return opts;
});

const monthOptions = computed(() => {
  return months.value.map((m, i) => ({ value: i, label: m.название || `Месяц ${i+1}` }));
});

const maxDaysInMonth = computed(() => {
  if (!calendar.value) return 30;
  return CalendarMath.getDaysInMonth(calendar.value, currentYear.value, currentMonthIdx.value);
});

const dayOptions = computed(() => {
  const opts = [];
  const max = maxDaysInMonth.value;
  for (let i = 1; i <= max; i++) {
    opts.push({ value: i, label: String(i) });
  }
  return opts;
});

const hourOptions = computed(() => {
  const opts = [];
  for (let i = 0; i < timeSettings.value.часов_в_сутках; i++) {
    opts.push({ value: i, label: String(i).padStart(2, '0') });
  }
  return opts;
});

const minuteOptions = computed(() => {
  const opts = [];
  for (let i = 0; i < timeSettings.value.минут_в_часе; i++) {
    opts.push({ value: i, label: String(i).padStart(2, '0') });
  }
  return opts;
});

const syncFromProps = (emitIfChanged = false) => {
  const val = props.modelValue;
  if (val && typeof val === 'object') {
    // Проверяем формат. Если старый формат (эпоха_ключ)
    if (val.эпоха_ключ !== undefined && !val.calendar_id && !val.original_input) {
      const defaultCal = allCalendars.value.find(c => c.is_default) || allCalendars.value[0];
      currentCalendarId.value = defaultCal?.id || '';
      currentEraIdx.value = val.эпоха_ключ;
      currentYear.value = val.год !== undefined ? val.год : currentEra.value.год_начала;
      currentMonthIdx.value = val.месяц !== undefined ? val.месяц : 0;
      currentDay.value = val.день !== undefined ? val.день : 1;
      currentHour.value = Math.floor(timeSettings.value.часов_в_сутках / 2);
      currentMinute.value = 0;
      emitIfChanged = true; // Принудительно эмиттим конвертацию
    } 
    // Если новый формат (CalendarDate)
    else if (val.calendar_id && val.original_input) {
      currentCalendarId.value = val.calendar_id;
      currentEraIdx.value = val.original_input.era_index;
      currentYear.value = val.original_input.year;
      currentMonthIdx.value = val.original_input.month;
      currentDay.value = val.original_input.day;
      currentHour.value = val.original_input.hour ?? Math.floor(timeSettings.value.часов_в_сутках / 2);
      currentMinute.value = val.original_input.minute ?? 0;
    }
  } else {
    // Поле пустое — устанавливаем дефолты локально, НЕ уведомляем родителя
    const defaultCal = allCalendars.value.find(c => c.is_default) || allCalendars.value[0];
    currentCalendarId.value = defaultCal?.id || '';
    currentEraIdx.value = 0;
    currentYear.value = currentEra.value.год_начала;
    currentMonthIdx.value = 0;
    currentDay.value = 1;
    currentHour.value = Math.floor(timeSettings.value.часов_в_сутках / 2);
    currentMinute.value = 0;
  }
  validateValues(emitIfChanged);
};

const validateValues = (emitIfChanged = false) => {
  if (!calendar.value) return;
  let changed = false;

  // Если календарь сменился или инициализирован, проверим эры
  if (currentEraIdx.value < 0 || currentEraIdx.value >= eras.value.length) {
    currentEraIdx.value = 0;
    changed = true;
  }

  // Year clamp
  if (currentYear.value < currentEra.value.год_начала) { currentYear.value = currentEra.value.год_начала; changed = true; }
  if (currentYear.value > currentEra.value.год_конца) { currentYear.value = currentEra.value.год_конца; changed = true; }
  
  // Month clamp
  if (currentMonthIdx.value < 0 || currentMonthIdx.value >= months.value.length) { currentMonthIdx.value = 0; changed = true; }
  
  // Day clamp
  const max = maxDaysInMonth.value;
  if (currentDay.value < 1) { currentDay.value = 1; changed = true; }
  if (currentDay.value > max) { currentDay.value = max; changed = true; }

  // Time clamp
  if (currentHour.value < 0 || currentHour.value >= timeSettings.value.часов_в_сутках) { currentHour.value = 0; changed = true; }
  if (currentMinute.value < 0 || currentMinute.value >= timeSettings.value.минут_в_часе) { currentMinute.value = 0; changed = true; }

  if (changed && emitIfChanged) emitUpdate();
};

const emitUpdate = () => {
  if (!calendar.value) return;

  const original_input = {
    era_index: currentEraIdx.value,
    year: currentYear.value,
    month: currentMonthIdx.value,
    day: currentDay.value
  };

  if (props.showTime) {
    original_input.hour = currentHour.value;
    original_input.minute = currentMinute.value;
  }

  const absolute_minute = CalendarMath.getAbsoluteMinute(original_input, calendar.value);

  emit('update:modelValue', {
    absolute_minute,
    calendar_id: currentCalendarId.value,
    original_input
  });
};

const onCalendarChange = () => {
  validateValues();
  emitUpdate();
};

const onEraChange = () => {
  if (currentYear.value < currentEra.value.год_начала || currentYear.value > currentEra.value.год_конца) {
    currentYear.value = currentEra.value.год_начала;
  }
  validateValues();
  emitUpdate();
};

const onYearChange = () => {
  validateValues();
  emitUpdate();
};

const onMonthChange = () => {
  validateValues();
  emitUpdate();
};

const onDayChange = () => {
  validateValues();
  emitUpdate();
};

const onTimeChange = () => {
  validateValues();
  emitUpdate();
};

onMounted(async () => {
  try {
    const list = await calendarService.getCalendars(props.project);
    allCalendars.value = list && list.length > 0 ? list : [{ id: 'temp', is_default: true, data: CalendarMath.getDefaultCalendar() }];
  } catch (e) {
    allCalendars.value = [{ id: 'temp', is_default: true, data: CalendarMath.getDefaultCalendar() }];
  }
  
  syncFromProps();

  settingsService.onChange(s => wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal');
});

watch(() => props.modelValue, (newVal) => {
  if (!newVal) return;
  // Check if we need to sync
  if (newVal.calendar_id && newVal.original_input) {
    if (
      newVal.calendar_id !== currentCalendarId.value ||
      newVal.original_input.era_index !== currentEraIdx.value ||
      newVal.original_input.year !== currentYear.value ||
      newVal.original_input.month !== currentMonthIdx.value ||
      newVal.original_input.day !== currentDay.value ||
      (props.showTime && newVal.original_input.hour !== currentHour.value) ||
      (props.showTime && newVal.original_input.minute !== currentMinute.value)
    ) {
      syncFromProps();
    }
  } else if (newVal.эпоха_ключ !== undefined) {
    // Old format detected during runtime (not ideal but should sync)
    syncFromProps(true);
  }
}, { deep: true });

</script>

<style scoped>
.date-wheels-container {
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
}
.date-wheel-group {
  display: flex;
  flex-direction: column;
}
.input-base {
  background: var(--bg-input, rgba(255,255,255,0.05));
  border: 1px solid var(--border-color, rgba(255,255,255,0.15));
  border-radius: 8px;
  color: var(--text-main, #fff);
  outline: none;
  transition: all 0.2s ease;
}
.input-base:focus {
  border-color: var(--accent, #7c3aed);
  background: var(--bg-input-focus, rgba(255,255,255,0.1));
}
</style>
