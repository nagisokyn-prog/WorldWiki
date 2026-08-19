<template>
  <div v-if="allCalendars.length > 0" class="date-wheels-container" style="display: flex; gap: 8px; align-items: center; background: var(--bg-card, rgba(0,0,0,0.2)); padding: 4px; border-radius: 12px; border: 1px solid var(--border-color); flex-wrap: wrap;">
    
    <!-- Календарь -->
    <div class="date-wheel-group" style="flex: 1.5; min-width: 140px;">
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
    <div class="date-wheel-group" style="flex: 1; min-width: 120px;">
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

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useUniversalDatePicker } from './useUniversalDatePicker';

const props = withDefaults(defineProps<{
  project: string;
  modelValue?: Record<string, any> | null;
  showTime?: boolean;
}>(), {
  modelValue: null,
  showTime: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: any): void;
}>();

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

<style scoped src="./UniversalDatePicker.vue.css"></style>
