<template>
  <div class="timeline-scene-card flex flex-col gap-2 p-2.5 bg-panel border border-border rounded">
    <div class="flex items-center justify-between gap-1.5">
      <div class="flex items-center gap-1.5 font-medium text-xs text-main">
        <span>⏱️</span>
        <span>Время действия</span>
      </div>
      <button
        type="button"
        class="btn-edit-date"
        @click="$emit('toggle-picker')"
      >
        {{ isDatePickerOpen ? '✓ Свернуть' : '⚙️ Барабаны' }}
      </button>
    </div>

    <!-- Диегетические бейджи -->
    <div v-if="diegeticInfo" class="diegetic-badges-row">
      <span class="badge-cal" title="Календарь">
        📅 {{ diegeticInfo.calendarName }}
      </span>
      <span v-if="diegeticInfo.seasonName" :class="['badge-season', diegeticInfo.seasonClass]">
        {{ diegeticInfo.seasonName }}
      </span>
      <span class="badge-time-of-day">
        {{ diegeticInfo.timeOfDayName }}
      </span>
      <span class="badge-date-text flex-1 text-right truncate" :title="diegeticInfo.formattedDate">
        {{ diegeticInfo.formattedDate }}
      </span>
    </div>

    <!-- Режим времени (Повествовательный контекст сцены) -->
    <div class="flex items-center justify-between gap-1.5 py-1 border-t border-border mt-0.5">
      <span class="text-xs text-muted">Поток времени:</span>
      <XboxWheel
        :model-value="currentTimeNature || 'present'"
        :options="timeNatureOptions"
        @update:model-value="$emit('update:currentTimeNature', $event); $emit('change')"
      />
    </div>

    <!-- Выбор календаря (при раскрытых барабанах) -->
    <div v-if="isDatePickerOpen && calendars && calendars.length > 1" class="flex items-center gap-2 py-1">
      <span class="text-xs text-muted">Календарь:</span>
      <XboxWheel
        :model-value="currentCalendarId"
        :options="calendarWheelOptions"
        class="flex-1"
        @update:model-value="$emit('update:currentCalendarId', $event); $emit('change')"
      />
    </div>

    <!-- Компактная двухрядная сетка XboxWheel (раскрывается по кнопке) -->
    <PromiseCardDateTimeWheels
      v-if="isDatePickerOpen"
      :current-era-idx="currentEraIdx"
      :current-year="currentYear"
      :current-month-idx="currentMonthIdx"
      :current-day="currentDay"
      :current-hour="currentHour"
      :current-minute="currentMinute"
      :era-wheel-options="eraWheelOptions"
      :year-wheel-options="yearWheelOptions"
      :month-wheel-options="monthWheelOptions"
      :day-wheel-options="dayWheelOptions"
      :hour-wheel-options="hourWheelOptions"
      :minute-wheel-options="minuteWheelOptions"
      :era-min-year="eraMinYear"
      :era-max-year="eraMaxYear"
      @update:current-era-idx="$emit('update:currentEraIdx', $event)"
      @update:current-year="$emit('update:currentYear', $event)"
      @update:current-month-idx="$emit('update:currentMonthIdx', $event)"
      @update:current-day="$emit('update:currentDay', $event)"
      @update:current-hour="$emit('update:currentHour', $event)"
      @update:current-minute="$emit('update:currentMinute', $event)"
      @change="$emit('change')"
    />
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { PromiseCardTimelineProps, PromiseCardTimelineEmits } from './PromiseCardTimeline.model';
import PromiseCardDateTimeWheels from '../PromiseCardDateTimeWheels/PromiseCardDateTimeWheels.vue';
import { usePromiseCardTimeline } from './usePromiseCardTimeline';

const props = defineProps<PromiseCardTimelineProps>();

defineEmits<PromiseCardTimelineEmits>();

const { timeNatureOptions, calendarWheelOptions } = usePromiseCardTimeline(props);
</script>
