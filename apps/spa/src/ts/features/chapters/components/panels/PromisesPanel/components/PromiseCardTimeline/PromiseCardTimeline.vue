<template>
  <div class="timeline-scene-card flex flex-col gap-2 p-2.5 bg-panel border border-border rounded">
    <div class="flex items-center justify-between gap-1.5">
      <div class="flex items-center gap-1.5 font-medium text-xs text-main">
        <span>⏱️</span>
        <span>Время действия</span>
      </div>
      <div class="flex items-center gap-1">
        <button v-if="hasPreviousDate" type="button" class="timeline-chip" title="Скопировать дату и время из предыдущей сцены" @click="$emit('copy-prev-date')">
          ↩ Из пред.
        </button>
        <button type="button" class="btn-edit-date" @click="$emit('toggle-picker')">
          {{ isDatePickerOpen ? '✓ Свернуть' : '⚙️ Настроить' }}
        </button>
      </div>
    </div>

    <!-- Диегетические бейджи -->
    <div v-if="diegeticInfo" class="diegetic-badges-row">
      <span class="badge-cal" title="Календарь">
        📅 {{ diegeticInfo.calendarName }}
      </span>
      <span v-if="diegeticInfo.seasonName" :class="['badge-season', diegeticInfo.seasonClass]">
        {{ diegeticInfo.seasonName }}
      </span>
      <span v-if="diegeticInfo.timeOfDayName" class="badge-time-of-day">
        {{ diegeticInfo.timeOfDayName }}
      </span>
      <span class="badge-date-text" :title="diegeticInfo.formattedDate">
        {{ diegeticInfo.formattedDate }}
      </span>
    </div>

    <!-- Быстрые дельты из активного календаря + время суток (1 клик без открытия барабанов) -->
    <div class="timeline-quick-row">
      <div v-if="dialDeltaChips && dialDeltaChips.length > 0" class="timeline-chip-group">
        <button
          v-for="chip in dialDeltaChips"
          :key="chip.label"
          type="button"
          class="timeline-chip"
          :title="chip.title"
          @click="$emit('shift-minutes', chip.deltaMinutes)"
        >
          {{ chip.label }}
        </button>

        <span v-for="entry in displayPresets" :key="entry.id" class="preset-chip">
          <button type="button" class="preset-chip-apply" :title="`Сдвиг: ${entry.displayLabel}`" @click="onApplySavedPreset(entry.preset)">
            {{ entry.displayLabel }}
          </button>
          <button type="button" class="preset-chip-del" title="Удалить пресет" @click.stop="removePreset(entry.id)">×</button>
        </span>

        <div class="time-jump-anchor">
          <button type="button" class="timeline-chip" :class="{ active: isJumpPopoverOpen }" title="Добавить свой интервал (годы, месяцы, дни, часы...)" @click="isJumpPopoverOpen = !isJumpPopoverOpen">
            ＋
          </button>
          <TimeJumpPopover
            v-if="isJumpPopoverOpen"
            :dial-delta-chips="dialDeltaChips"
            @apply="onApplyJumpOnce"
            @save-and-apply="onSaveAndApplyJump"
            @close="isJumpPopoverOpen = false"
          />
        </div>
      </div>

      <div class="timeline-chip-group">
        <button
          v-for="tod in timeOfDayOptions"
          :key="tod.value"
          type="button"
          class="timeline-chip timeline-chip-icon"
          :class="{ active: timeOfDay === tod.value }"
          :title="tod.title"
          @click="$emit('select-time-of-day', timeOfDay === tod.value ? null : tod.value)"
        >
          {{ tod.icon }}
        </button>
      </div>
    </div>

    <!-- 1-кликовый переключатель «Поток времени» -->
    <div class="time-nature-chips">
      <button
        v-for="opt in timeNatureOptions"
        :key="opt.value"
        type="button"
        class="timeline-chip time-nature-btn"
        :class="{ active: (currentTimeNature || 'present') === opt.value }"
        @click="$emit('update:currentTimeNature', opt.value); $emit('change')"
      >
        <span>{{ opt.icon }}</span>
        <span>{{ opt.label }}</span>
      </button>
    </div>

    <!-- Панель точности и приблизительности (при раскрытых настройках) -->
    <div v-if="isDatePickerOpen" class="precision-bar">
      <button
        v-for="p in precisionOptions"
        :key="p.value"
        type="button"
        class="timeline-chip"
        :class="{ active: (datePrecision || 'exact') === p.value }"
        @click="$emit('update:datePrecision', p.value)"
      >
        {{ p.label }}
      </button>
      <button
        type="button"
        class="timeline-chip approx-chip"
        :class="{ active: isApproximate }"
        title="Пометить дату как приблизительную (≈)"
        @click="$emit('toggle-approximate')"
      >
        ≈ примерно
      </button>
    </div>

    <!-- Выбор календаря (при раскрытых настройках) -->
    <div v-if="isDatePickerOpen && calendars && calendars.length > 1" class="flex items-center gap-2 py-1">
      <span class="text-xs text-muted">Календарь:</span>
      <XboxWheel
        :model-value="currentCalendarId"
        :options="calendarWheelOptions"
        class="flex-1"
        @update:model-value="$emit('update:currentCalendarId', $event); $emit('change')"
      />
    </div>

    <!-- Адаптивная сетка даты и времени -->
    <PromiseCardDateTimeWheels
      v-if="isDatePickerOpen"
      :date-precision="datePrecision || 'exact'"
      :current-era-idx="currentEraIdx"
      :current-year="currentYear"
      :current-month-idx="currentMonthIdx"
      :current-day="currentDay"
      :current-hour="currentHour"
      :current-minute="currentMinute"
      :end-year="endYear"
      :end-month-idx="endMonthIdx"
      :current-season-idx="currentSeasonIdx"
      :era-wheel-options="eraWheelOptions"
      :year-wheel-options="yearWheelOptions"
      :month-wheel-options="monthWheelOptions"
      :day-wheel-options="dayWheelOptions"
      :hour-wheel-options="hourWheelOptions"
      :minute-wheel-options="minuteWheelOptions"
      :season-wheel-options="seasonWheelOptions"
      :era-min-year="eraMinYear"
      :era-max-year="eraMaxYear"
      @update:current-era-idx="$emit('update:currentEraIdx', $event)"
      @update:current-year="$emit('update:currentYear', $event)"
      @update:current-month-idx="$emit('update:currentMonthIdx', $event)"
      @update:current-day="$emit('update:currentDay', $event)"
      @update:current-hour="$emit('update:currentHour', $event)"
      @update:current-minute="$emit('update:currentMinute', $event)"
      @update:end-year="$emit('update:endYear', $event)"
      @update:end-month-idx="$emit('update:endMonthIdx', $event)"
      @update:current-season-idx="$emit('update:currentSeasonIdx', $event)"
      @change="$emit('change')"
    />
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { PromiseCardTimelineProps, PromiseCardTimelineEmits } from './PromiseCardTimeline.model';
import PromiseCardDateTimeWheels from '../PromiseCardDateTimeWheels/PromiseCardDateTimeWheels.vue';
import TimeJumpPopover from './components/TimeJumpPopover.vue';
import { usePromiseCardTimeline } from './usePromiseCardTimeline';

const props = defineProps<PromiseCardTimelineProps>();

const emit = defineEmits<PromiseCardTimelineEmits>();

const {
  isJumpPopoverOpen,
  displayPresets,
  removePreset,
  onApplyJumpOnce,
  onSaveAndApplyJump,
  onApplySavedPreset,
  timeNatureOptions,
  timeOfDayOptions,
  precisionOptions,
  calendarWheelOptions
} = usePromiseCardTimeline(props, emit);
</script>
