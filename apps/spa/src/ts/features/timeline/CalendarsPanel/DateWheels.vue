<template>
  <div v-if="calendar" class="date-wheels-container">
    
    <!-- Эпоха -->
    <div v-if="eras.length > 1" class="date-wheel-group grow-sm">
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

  </div>
  <div v-else class="loading-state">Загрузка календаря...</div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useDateWheels } from './useDateWheels';
import type { DateWheelsProps, DateWheelsModelValue } from './useDateWheels';

const props = withDefaults(defineProps<DateWheelsProps>(), {
  modelValue: null
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: DateWheelsModelValue | null): void;
}>();

const {
  wheelHorizontal,
  calendar,
  currentEraIdx,
  currentYear,
  currentMonthIdx,
  currentDay,
  eras,
  yearInputMode,
  eraOptions,
  yearOptions,
  monthOptions,
  dayOptions,
  onEraChange,
  onYearChange,
  onMonthChange,
  onDayChange,
  currentEra
} = useDateWheels(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/DateWheels.css"></style>
