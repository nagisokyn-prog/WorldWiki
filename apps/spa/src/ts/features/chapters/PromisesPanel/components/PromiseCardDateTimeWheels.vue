<template>
  <div class="compact-wheels-grid">
    <!-- Ряд 1: [ Эпоха ] [ Год ] [ Месяц ] -->
    <div class="wheels-row">
      <div class="wheel-cell">
        <label class="wheel-label">Эпоха</label>
        <XboxWheel
          :model-value="currentEraIdx"
          :options="eraWheelOptions"
          placeholder="Эпоха"
          @update:model-value="$emit('update:currentEraIdx', Number($event)); $emit('change')"
        />
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">Год</label>
        <XboxWheel
          :model-value="currentYear"
          :options="yearWheelOptions"
          placeholder="Год"
          @update:model-value="$emit('update:currentYear', Number($event)); $emit('change')"
        />
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">Месяц</label>
        <XboxWheel
          :model-value="currentMonthIdx"
          :options="monthWheelOptions"
          placeholder="Месяц"
          @update:model-value="$emit('update:currentMonthIdx', Number($event)); $emit('change')"
        />
      </div>
    </div>

    <!-- Ряд 2: [ День ] [ Час ] [ Минута ] -->
    <div class="wheels-row">
      <div class="wheel-cell">
        <label class="wheel-label">День</label>
        <XboxWheel
          :model-value="currentDay"
          :options="dayWheelOptions"
          placeholder="День"
          @update:model-value="$emit('update:currentDay', Number($event)); $emit('change')"
        />
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">Час</label>
        <XboxWheel
          :model-value="currentHour"
          :options="hourWheelOptions"
          placeholder="Час"
          @update:model-value="$emit('update:currentHour', Number($event)); $emit('change')"
        />
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">Мин</label>
        <XboxWheel
          :model-value="currentMinute"
          :options="minuteWheelOptions"
          placeholder="Мин"
          @update:model-value="$emit('update:currentMinute', Number($event)); $emit('change')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';

defineProps<{
  currentEraIdx: number;
  currentYear: number;
  currentMonthIdx: number;
  currentDay: number;
  currentHour: number;
  currentMinute: number;
  eraWheelOptions: Array<{ value: number; label: string }>;
  yearWheelOptions: Array<{ value: number; label: string }>;
  monthWheelOptions: Array<{ value: number; label: string }>;
  dayWheelOptions: Array<{ value: number; label: string }>;
  hourWheelOptions: Array<{ value: number; label: string }>;
  minuteWheelOptions: Array<{ value: number; label: string }>;
}>();

defineEmits<{
  (e: 'update:currentEraIdx', val: number): void;
  (e: 'update:currentYear', val: number): void;
  (e: 'update:currentMonthIdx', val: number): void;
  (e: 'update:currentDay', val: number): void;
  (e: 'update:currentHour', val: number): void;
  (e: 'update:currentMinute', val: number): void;
  (e: 'change'): void;
}>();
</script>
