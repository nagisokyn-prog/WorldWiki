<template>
  <div v-if="allCalendars.length > 0" class="date-wheels-container">
    
    <!-- Календарь -->
    <div class="date-wheel-group wheel-group-calendar">
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
    <div class="date-wheel-group wheel-group-era">
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
    <div class="date-wheel-group wheel-group-year">
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
    <div class="date-wheel-group wheel-group-month">
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
    <div class="date-wheel-group wheel-group-day">
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
      <div v-if="!isHourHidden" class="date-wheel-group wheel-group-hour">
        <div class="date-wheel-label">
          <span>Час</span>
          <button
            type="button"
            class="wheel-hide-btn"
            title="Скрыть час"
            @click.stop="isHourHidden = true"
          >
            👁️‍🗨️
          </button>
        </div>
        <XboxWheel
          v-model="currentHour" 
          :horizontal="wheelHorizontal"
          :options="hourOptions"
          placeholder="Час"
          @update:model-value="onTimeChange"
        />
      </div>

      <div v-if="!isHourHidden && !isMinuteHidden" class="time-separator">:</div>

      <!-- Минута -->
      <div v-if="!isMinuteHidden" class="date-wheel-group wheel-group-minute">
        <div class="date-wheel-label">
          <span>Мин</span>
          <button
            type="button"
            class="wheel-hide-btn"
            title="Скрыть минуты"
            @click.stop="isMinuteHidden = true"
          >
            👁️‍🗨️
          </button>
        </div>
        <XboxWheel
          v-model="currentMinute" 
          :horizontal="wheelHorizontal"
          :options="minuteOptions"
          placeholder="Мин"
          @update:model-value="onTimeChange"
        />
      </div>

      <!-- Восстановление скрытого времени -->
      <div v-if="isHourHidden || isMinuteHidden" class="date-wheel-group restore-time-group">
        <button
          type="button"
          class="btn-restore-time"
          :title="isHourHidden && isMinuteHidden ? 'Показать время (час и мин)' : isHourHidden ? 'Показать час' : 'Показать минуты'"
          @click.stop="restoreTime"
        >
          <span>👁️‍🗨️</span>
          <span>+{{ isHourHidden && isMinuteHidden ? 'Время' : isHourHidden ? 'Час' : 'Мин' }}</span>
        </button>
      </div>
    </template>

  </div>
  <div v-else class="loading-state">Загрузка календарей...</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { UniversalDatePickerProps, UniversalDatePickerEmits } from './UniversalDatePicker.model';
import { XboxWheel } from '@worldwiki/components';
import { useUniversalDatePicker } from './useUniversalDatePicker';

const props = withDefaults(defineProps<UniversalDatePickerProps>(), {
  modelValue: null,
  showTime: false
});

const emit = defineEmits<UniversalDatePickerEmits>();

const isHourHidden = ref(false);
const isMinuteHidden = ref(false);

const restoreTime = () => {
  isHourHidden.value = false;
  isMinuteHidden.value = false;
};

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
