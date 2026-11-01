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

    <!-- Выбор календаря (при раскрытых барабанах) -->
    <div v-if="isDatePickerOpen && calendars && calendars.length > 1" class="flex items-center gap-2 py-1">
      <span class="text-xs text-muted">Календарь:</span>
      <select
        :value="currentCalendarId"
        class="bg-surface-subtle text-main border border-border rounded px-2 py-1 text-xs flex-1 cursor-pointer focus:outline-none focus:border-accent"
        @change="$emit('update:currentCalendarId', ($event.target as HTMLSelectElement).value); $emit('change')"
      >
        <option v-for="cal in calendars" :key="cal.id" :value="cal.id">
          {{ cal.data?.название || cal.name || 'Календарь' }}
        </option>
      </select>
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
import type { PromiseCardTimelineProps, PromiseCardTimelineEmits } from './PromiseCardTimeline.model';
import PromiseCardDateTimeWheels from './PromiseCardDateTimeWheels.vue';

defineProps<PromiseCardTimelineProps>();

defineEmits<PromiseCardTimelineEmits>();
</script>
