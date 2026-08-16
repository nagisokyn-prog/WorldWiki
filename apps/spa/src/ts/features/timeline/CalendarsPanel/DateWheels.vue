<template>
  <div v-if="calendar" class="date-wheels-container" style="display: flex; gap: 8px; align-items: center; background: var(--bg-card, rgba(0,0,0,0.2)); padding: 4px; border-radius: 12px; border: 1px solid var(--border-color);">
    
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

  </div>
  <div v-else style="padding: 10px; color: var(--text-muted); font-size: 12px;">Загрузка календаря...</div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useDateWheels } from './useDateWheels';

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

<style scoped src="./DateWheels.vue.css"></style>
