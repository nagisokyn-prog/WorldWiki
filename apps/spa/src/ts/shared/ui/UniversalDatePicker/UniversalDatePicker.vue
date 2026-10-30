<template>
  <div v-if="allCalendars.length > 0" class="date-wheels-container">
    
    <!-- Календарь -->
    <div class="date-wheel-group grow-md">
      <div class="date-wheel-label">Календарь</div>
      <XboxWheel
        v-model="currentCalendarId"
        :horizontal="wheelHorizontal"
        :options="calendarOptions"
        placeholder="Календарь"
        @update:model-value="onCalendarChange"
      />
    </div>

    <!-- Эпоха -->
    <div class="date-wheel-group grow-sm">
      <div class="date-wheel-label">Эпоха</div>
      <XboxWheel
        v-model="currentEraIdx" 
        :horizontal="wheelHorizontal"
        :options="eraOptions"
        placeholder="Эпоха"
        @update:model-value="onEraChange"
      />
    </div>

    <!-- Год -->
    <div class="date-wheel-group grow-xs">
      <div class="date-wheel-label">Год</div>
      <template v-if="yearInputMode">
        <input 
          v-model.number="currentYear" 
          type="number"
          :min="currentEra.год_начала" 
          :max="currentEra.год_конца"
          class="input-base year-input-wheel"
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
    <div class="date-wheel-group grow-md">
      <div class="date-wheel-label">Месяц</div>
      <XboxWheel
        v-model="currentMonthIdx" 
        :horizontal="wheelHorizontal"
        :options="monthOptions"
        placeholder="Месяц"
        @update:model-value="onMonthChange"
      />
    </div>

    <!-- День -->
    <div class="date-wheel-group grow-mini">
      <div class="date-wheel-label">День</div>
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
      <div class="date-wheel-group grow-mini">
        <div class="date-wheel-label">Час</div>
        <XboxWheel
          v-model="currentHour" 
          :horizontal="wheelHorizontal"
          :options="hourOptions"
          placeholder="Час"
          @update:model-value="onTimeChange"
        />
      </div>

      <div class="time-separator">:</div>

      <!-- Минута -->
      <div class="date-wheel-group grow-mini">
        <div class="date-wheel-label">Мин</div>
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
  <div v-else class="loading-state">Загрузка календарей...</div>
</template>

<script setup lang="ts">
import type { UniversalDatePickerProps, UniversalDatePickerEmits } from './UniversalDatePicker.model';
import { XboxWheel } from '@worldwiki/components';
import { useUniversalDatePicker } from './useUniversalDatePicker';
import type { DatePickerModelValue } from './useUniversalDatePicker';

const props = withDefaults(defineProps<UniversalDatePickerProps>(), {
  modelValue: null,
  showTime: false
});

const emit = defineEmits<UniversalDatePickerEmits>();

const {
  allCalendars,
  currentCalendarId,
  currentEraIdx,
  currentYear,
  currentMonthIdx,
  currentDay,
  currentHour,
  currentMinute,
  calendarOptions,
  eraOptions,
  yearOptions,
  monthOptions,
  dayOptions,
  hourOptions,
  minuteOptions,
  currentEra,
  yearInputMode,
  wheelHorizontal,
  onCalendarChange,
  onEraChange,
  onYearChange,
  onMonthChange,
  onDayChange,
  onTimeChange
} = useUniversalDatePicker(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/UniversalDatePicker.css"></style>
