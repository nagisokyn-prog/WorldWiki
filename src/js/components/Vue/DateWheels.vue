<template>
  <div class="date-wheels-container" v-if="calendar" style="display: flex; gap: 8px; align-items: center; background: var(--bg-card, rgba(0,0,0,0.2)); padding: 4px; border-radius: 12px; border: 1px solid var(--border-color);">
    
    <!-- Эпоха -->
    <div v-if="eras.length > 1" class="date-wheel-group" style="flex: 1; min-width: 120px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Эпоха</div>
      <XboxWheel :horizontal="wheelHorizontal" 
        v-model="currentEraIdx"
        :options="eraOptions"
        placeholder="Эпоха"
        @update:modelValue="onEraChange"
      />
    </div>

    <!-- Год -->
    <div class="date-wheel-group" style="flex: 1; min-width: 90px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Год</div>
      <template v-if="yearInputMode">
        <input 
          type="number" 
          v-model.number="currentYear"
          :min="currentEra.год_начала" 
          :max="currentEra.год_конца"
          class="input-base"
          style="text-align: center; height: 44px; padding: 0; box-sizing: border-box;"
          @change="onYearChange"
        />
      </template>
      <template v-else>
        <XboxWheel :horizontal="wheelHorizontal" 
          v-model="currentYear"
          :options="yearOptions"
          placeholder="Год"
          @update:modelValue="onYearChange"
        />
      </template>
    </div>

    <!-- Месяц -->
    <div class="date-wheel-group" style="flex: 1.5; min-width: 140px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">Месяц</div>
      <XboxWheel :horizontal="wheelHorizontal" 
        v-model="currentMonthIdx"
        :options="monthOptions"
        placeholder="Месяц"
        @update:modelValue="onMonthChange"
      />
    </div>

    <!-- День -->
    <div class="date-wheel-group" style="flex: 0.8; min-width: 70px;">
      <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 4px; text-transform: uppercase;">День</div>
      <XboxWheel :horizontal="wheelHorizontal" 
        v-model="currentDay"
        :options="dayOptions"
        placeholder="День"
        @update:modelValue="onDayChange"
      />
    </div>

  </div>
  <div v-else style="padding: 10px; color: var(--text-muted); font-size: 12px;">Загрузка календаря...</div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import XboxWheel from './XboxWheel.vue';
import { calendarService } from '../../services/calendar.service';
import { settingsService } from '../../services/settings.service';

const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => null
  },
  project: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:modelValue']);

const calendar = ref(null);

const currentEraIdx = ref(0);
const currentYear = ref(1);
const currentMonthIdx = ref(0);
const currentDay = ref(1);

const eras = computed(() => calendar.value?.эпохи || []);
const months = computed(() => calendar.value?.месяцы || []);

const currentEra = computed(() => eras.value[currentEraIdx.value] || eras.value[0] || { год_начала: 1, год_конца: 9999, название: '' });

const yearRange = computed(() => currentEra.value.год_конца - currentEra.value.год_начала);
const yearInputMode = computed(() => yearRange.value > 500);

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
  return calendarService.getDaysInMonth(calendar.value, currentYear.value, currentMonthIdx.value);
});

const dayOptions = computed(() => {
  const opts = [];
  const max = maxDaysInMonth.value;
  for (let i = 1; i <= max; i++) {
    opts.push({ value: i, label: String(i) });
  }
  return opts;
});

// Синхронизация при загрузке
const syncFromProps = (emitIfChanged = false) => {
  const val = props.modelValue;
  if (val && typeof val === 'object') {
    currentEraIdx.value = val.эпоха_ключ !== undefined ? val.эпоха_ключ : 0;
    currentYear.value = val.год !== undefined ? val.год : currentEra.value.год_начала;
    currentMonthIdx.value = val.месяц !== undefined ? val.месяц : 0;
    currentDay.value = val.день !== undefined ? val.день : 1;
  } else {
    // Поле пустое — устанавливаем дефолты локально, НЕ уведомляем родителя
    currentEraIdx.value = 0;
    currentYear.value = currentEra.value.год_начала;
    currentMonthIdx.value = 0;
    currentDay.value = 1;
  }
  validateValues(emitIfChanged);
};

const validateValues = (emitIfChanged = false) => {
  let changed = false;
  // Year clamp
  if (currentYear.value < currentEra.value.год_начала) { currentYear.value = currentEra.value.год_начала; changed = true; }
  if (currentYear.value > currentEra.value.год_конца) { currentYear.value = currentEra.value.год_конца; changed = true; }
  // Month clamp
  if (currentMonthIdx.value < 0 || currentMonthIdx.value >= months.value.length) { currentMonthIdx.value = 0; changed = true; }
  // Day clamp
  const max = maxDaysInMonth.value;
  if (currentDay.value < 1) { currentDay.value = 1; changed = true; }
  if (currentDay.value > max) { currentDay.value = max; changed = true; }

  if (changed && emitIfChanged) emitUpdate();
};

const emitUpdate = () => {
  emit('update:modelValue', {
    эпоха_ключ: currentEraIdx.value,
    год: currentYear.value,
    месяц: currentMonthIdx.value,
    день: currentDay.value
  });
};

const onEraChange = () => {
  // Сбрасываем год на начало новой эпохи, если он не попадает в новый диапазон
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

onMounted(async () => {
  let cal = await calendarService.loadCalendar(props.project);
  if (!cal) cal = calendarService.getDefaultCalendar();
  calendar.value = cal;
  
  syncFromProps();

  settingsService.onChange(s => wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal');
});

watch(() => props.modelValue, (newVal) => {
  if (!newVal) return;
  if (
    newVal.эпоха_ключ !== currentEraIdx.value ||
    newVal.год !== currentYear.value ||
    newVal.месяц !== currentMonthIdx.value ||
    newVal.день !== currentDay.value
  ) {
    syncFromProps();
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
