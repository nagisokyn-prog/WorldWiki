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
import PromiseCardDateTimeWheels from './PromiseCardDateTimeWheels.vue';
import type { DiegeticDateBadgeInfo } from './PromiseCardMeta.model';

defineProps<{
  isDatePickerOpen: boolean;
  diegeticInfo: DiegeticDateBadgeInfo | null;
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
  (e: 'toggle-picker'): void;
  (e: 'update:currentEraIdx', val: number): void;
  (e: 'update:currentYear', val: number): void;
  (e: 'update:currentMonthIdx', val: number): void;
  (e: 'update:currentDay', val: number): void;
  (e: 'update:currentHour', val: number): void;
  (e: 'update:currentMinute', val: number): void;
  (e: 'change'): void;
}>();
</script>
