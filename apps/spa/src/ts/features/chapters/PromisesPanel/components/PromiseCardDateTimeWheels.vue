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
        <div class="flex items-center justify-between gap-1 mb-1">
          <label class="wheel-label">Год</label>
          <input
            type="number"
            :value="currentYear"
            class="w-14 px-1 py-0.5 text-xs text-right bg-panel border border-border rounded text-main focus:outline-none focus:border-accent"
            :min="eraMinYear ?? 1"
            :max="eraMaxYear ?? undefined"
            title="Прямой ввод года"
            @change="$emit('update:currentYear', Math.min(eraMaxYear ?? Infinity, Math.max(eraMinYear ?? 1, Number(($event.target as HTMLInputElement).value) || (eraMinYear ?? 1)))); $emit('change')"
            @keydown.enter="$emit('update:currentYear', Math.min(eraMaxYear ?? Infinity, Math.max(eraMinYear ?? 1, Number(($event.target as HTMLInputElement).value) || (eraMinYear ?? 1)))); $emit('change')"
          />
        </div>
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
import type { PromiseCardDateTimeWheelsProps, PromiseCardDateTimeWheelsEmits } from './PromiseCardDateTimeWheels.model';
import { XboxWheel } from '@worldwiki/components';

const props = defineProps<PromiseCardDateTimeWheelsProps>();

const emit = defineEmits<PromiseCardDateTimeWheelsEmits>();

const handleYearInput = (rawVal: string) => {
  const num = Number(rawVal);
  if (isNaN(num)) return;
  const min = props.eraMinYear ?? 1;
  const max = props.eraMaxYear ?? Infinity;
  const clamped = Math.min(max, Math.max(min, num));
  emit('update:currentYear', clamped);
  emit('change');
};
</script>
