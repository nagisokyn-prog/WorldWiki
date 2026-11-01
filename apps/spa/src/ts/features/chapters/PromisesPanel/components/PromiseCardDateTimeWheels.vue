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
          @update:model-value="onEraChange"
        />
      </div>

      <div class="wheel-cell">
        <div class="flex items-center justify-between gap-1 mb-1">
          <label class="wheel-label">Год</label>
          <input
            type="number"
            :value="currentYear"
            class="w-14 px-1 py-0.5 text-xs text-right bg-panel border border-border rounded text-main focus:outline-none focus:border-accent"
            :min="eraMinYear ?? 1"
            :max="eraMaxYear ?? undefined"
            title="Прямой ввод года"
            @change="handleYearInput(($event.target as HTMLInputElement).value)"
            @keydown.enter="handleYearInput(($event.target as HTMLInputElement).value)"
          />
        </div>
        <XboxWheel
          :model-value="currentYear"
          :options="yearWheelOptions"
          placeholder="Год"
          @update:model-value="onYearChange"
        />
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">Месяц</label>
        <XboxWheel
          :model-value="currentMonthIdx"
          :options="monthWheelOptions"
          placeholder="Месяц"
          @update:model-value="onMonthChange"
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
          @update:model-value="onDayChange"
        />
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">Час</label>
        <XboxWheel
          :model-value="currentHour"
          :options="hourWheelOptions"
          placeholder="Час"
          @update:model-value="onHourChange"
        />
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">Мин</label>
        <XboxWheel
          :model-value="currentMinute"
          :options="minuteWheelOptions"
          placeholder="Мин"
          @update:model-value="onMinuteChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromiseCardDateTimeWheelsProps, PromiseCardDateTimeWheelsEmits } from './PromiseCardDateTimeWheels.model';
import { XboxWheel } from '@worldwiki/components';
import { usePromiseCardDateTimeWheels } from './usePromiseCardDateTimeWheels';

const props = defineProps<PromiseCardDateTimeWheelsProps>();
const emit = defineEmits<PromiseCardDateTimeWheelsEmits>();

const {
  handleYearInput,
  onEraChange,
  onYearChange,
  onMonthChange,
  onDayChange,
  onHourChange,
  onMinuteChange
} = usePromiseCardDateTimeWheels(props, emit);
</script>
