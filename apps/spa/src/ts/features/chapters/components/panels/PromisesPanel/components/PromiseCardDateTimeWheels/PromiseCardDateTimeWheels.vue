<template>
  <div class="compact-wheels-grid">
    <!-- Ряд 1: [ Эпоха ] [ Год (без дубля барабана) ] [ Месяц / Сезон ] -->
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
        <label class="wheel-label">Год</label>
        <div class="year-stepper">
          <button type="button" class="year-step-btn" title="-1 год" @click="stepYear(-1)">−</button>
          <input
            type="number"
            :value="currentYear"
            class="year-step-input"
            :min="eraMinYear ?? 1"
            :max="eraMaxYear ?? undefined"
            title="Прямой ввод года"
            @change="handleYearInput(($event.target as HTMLInputElement).value)"
            @keydown.enter="handleYearInput(($event.target as HTMLInputElement).value)"
          />
          <button type="button" class="year-step-btn" title="+1 год" @click="stepYear(1)">+</button>
        </div>
      </div>

      <div v-if="datePrecision === 'season' && seasonWheelOptions && seasonWheelOptions.length > 0" class="wheel-cell">
        <label class="wheel-label">Сезон</label>
        <XboxWheel
          :model-value="currentSeasonIdx ?? 0"
          :options="seasonWheelOptions"
          placeholder="Сезон"
          @update:model-value="onSeasonChange"
        />
      </div>

      <div v-else-if="datePrecision !== 'year'" class="wheel-cell">
        <label class="wheel-label">{{ datePrecision === 'range' ? 'От (Месяц)' : 'Месяц' }}</label>
        <XboxWheel
          :model-value="currentMonthIdx"
          :options="monthWheelOptions"
          placeholder="Месяц"
          @update:model-value="onMonthChange"
        />
      </div>
    </div>

    <!-- Ряд 2 для диапазона (От — До): [ До: Год ] [ До: Месяц ] -->
    <div v-if="datePrecision === 'range'" class="wheels-row">
      <div class="wheel-cell">
        <label class="wheel-label">До (Год)</label>
        <div class="year-stepper">
          <button type="button" class="year-step-btn" @click="handleEndYearInput((endYear ?? currentYear) - 1)">−</button>
          <input
            type="number"
            :value="endYear ?? currentYear"
            class="year-step-input"
            :min="currentYear"
            :max="eraMaxYear ?? undefined"
            @change="handleEndYearInput(($event.target as HTMLInputElement).value)"
            @keydown.enter="handleEndYearInput(($event.target as HTMLInputElement).value)"
          />
          <button type="button" class="year-step-btn" @click="handleEndYearInput((endYear ?? currentYear) + 1)">+</button>
        </div>
      </div>

      <div class="wheel-cell">
        <label class="wheel-label">До (Месяц)</label>
        <XboxWheel
          :model-value="endMonthIdx ?? currentMonthIdx"
          :options="monthWheelOptions"
          placeholder="Месяц"
          @update:model-value="onEndMonthChange"
        />
      </div>
    </div>

    <!-- Ряд 2 для точной даты / дня: [ День ] [ Час ] [ Минута ] -->
    <div v-if="!datePrecision || datePrecision === 'exact' || datePrecision === 'day'" class="wheels-row">
      <div class="wheel-cell">
        <label class="wheel-label">День</label>
        <XboxWheel
          :model-value="currentDay"
          :options="dayWheelOptions"
          placeholder="День"
          @update:model-value="onDayChange"
        />
      </div>

      <div v-if="!datePrecision || datePrecision === 'exact'" class="wheel-cell">
        <label class="wheel-label">Час</label>
        <XboxWheel
          :model-value="currentHour"
          :options="hourWheelOptions"
          placeholder="Час"
          @update:model-value="onHourChange"
        />
      </div>

      <div v-if="!datePrecision || datePrecision === 'exact'" class="wheel-cell">
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
  stepYear,
  handleEndYearInput,
  onEraChange,
  onMonthChange,
  onDayChange,
  onHourChange,
  onMinuteChange,
  onEndMonthChange,
  onSeasonChange
} = usePromiseCardDateTimeWheels(props, emit);
</script>
