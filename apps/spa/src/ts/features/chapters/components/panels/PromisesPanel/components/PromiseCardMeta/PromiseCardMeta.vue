<template>
  <div class="promise-card-meta p-2.5 bg-surface-subtle border-b border-subtle flex flex-col gap-2.5 text-xs">
    <!-- 1. Локация и копирование контекста из предыдущей сцены -->
    <PromiseCardLocationRow
      v-model:location-draft="locationDraft"
      :is-entity-location="isEntityLocation"
      :has-location-id="Boolean(item.location_id)"
      :is-dropdown-open="isLocationDropdownOpen"
      :filtered-locations="filteredLocations"
      :has-previous-scene="Boolean(previousScene)"
      :block-badge-text="blockBadgeText"
      @open-dropdown="isLocationDropdownOpen = true"
      @close-dropdown="isLocationDropdownOpen = false"
      @blur="onLocationBlur"
      @select="selectLocation"
      @clear="clearLocation"
      @copy-context="copyContextFromPrevious"
    />

    <!-- 2. Сюжетные Арки и Фазы (Мульти-привязка к аркам сцены) -->
    <PromiseCardArcTags
      :project="project"
      :arcs="effectiveArcs"
      :available-arcs="availableArcs"
      @update:arcs="onArcsUpdate"
      @change="$emit('change')"
    />

    <!-- 3. Участники сцены/блока -->
    <PromiseCardParticipants
      v-model:participant-input-query="participantInputQuery"
      :current-participants="currentParticipants"
      :is-participant-dropdown-open="isParticipantDropdownOpen"
      :available-characters="availableCharacters"
      :get-participant-display-name="getParticipantDisplayName"
      @open-dropdown="isParticipantDropdownOpen = true"
      @close-dropdown="isParticipantDropdownOpen = false"
      @add-participant="addParticipant"
      @remove-participant="removeParticipant"
      @backspace="handleParticipantBackspace"
    />

    <!-- 4. Время действия сцены -->
    <PromiseCardTimeline
      :project="project"
      :is-date-picker-open="isDatePickerOpen"
      :diegetic-info="diegeticInfo"
      :calendars="calendars"
      :current-calendar-id="currentCalendarId"
      :current-time-nature="item.time_nature || 'present'"
      :date-precision="datePrecision"
      :is-approximate="isApproximate"
      :time-of-day="timeOfDay"
      :has-previous-date="Boolean(previousScene && previousScene.m_abs !== undefined && previousScene.m_abs !== null)"
      :dial-delta-chips="dialDeltaChips"
      :season-wheel-options="seasonWheelOptions"
      :current-season-idx="currentSeasonIdx"
      :end-year="endYear"
      :end-month-idx="endMonthIdx"
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
      @toggle-picker="toggleDatePicker"
      @copy-prev-date="copyDateFromPrevious"
      @shift-minutes="onShiftMinutes"
      @shift-preset="onShiftPreset"
      @select-time-of-day="onTimeOfDaySelect"
      @update:date-precision="onPrecisionChange"
      @toggle-approximate="onToggleApproximate"
      @update:current-season-idx="onSeasonChange"
      @update:end-year="onEndYearChange"
      @update:end-month-idx="onEndMonthChange"
      @update:current-calendar-id="onCalendarChange"
      @update:current-time-nature="item.time_nature = $event; $emit('change')"
      @update:current-era-idx="onEraChange"
      @update:current-year="onYearChange"
      @update:current-month-idx="currentMonthIdx = $event"
      @update:current-day="currentDay = $event"
      @update:current-hour="currentHour = $event"
      @update:current-minute="currentMinute = $event"
      @change="onDateFieldsChange"
    />
  </div>
</template>

<script setup lang="ts">
import PromiseCardLocationRow from './components/PromiseCardLocationRow.vue';
import PromiseCardArcTags from '../PromiseCardArcTags/PromiseCardArcTags.vue';
import PromiseCardParticipants from '../PromiseCardParticipants/PromiseCardParticipants.vue';
import PromiseCardTimeline from '../PromiseCardTimeline/PromiseCardTimeline.vue';
import { usePromiseCardMeta } from './usePromiseCardMeta';
import type { PromiseCardMetaProps, PromiseCardMetaEmits } from './PromiseCardMeta.model';

const props = defineProps<PromiseCardMetaProps>();
const emit = defineEmits<PromiseCardMetaEmits>();

const {
  blockBadgeText,
  locationDraft,
  isLocationDropdownOpen,
  filteredLocations,
  isEntityLocation,
  selectLocation,
  onLocationBlur,
  clearLocation,
  participantInputQuery,
  isParticipantDropdownOpen,
  isDatePickerOpen,
  availableArcs,
  currentParticipants,
  availableCharacters,
  getParticipantDisplayName,
  calendars,
  currentCalendarId,
  eraWheelOptions,
  yearWheelOptions,
  monthWheelOptions,
  dayWheelOptions,
  hourWheelOptions,
  minuteWheelOptions,
  eraMinYear,
  eraMaxYear,
  currentEraIdx,
  currentYear,
  currentMonthIdx,
  currentDay,
  currentHour,
  currentMinute,
  datePrecision,
  isApproximate,
  timeOfDay,
  endYear,
  endMonthIdx,
  currentSeasonIdx,
  seasonWheelOptions,
  dialDeltaChips,
  diegeticInfo,
  onEraChange,
  onYearChange,
  onShiftMinutes,
  onShiftPreset,
  onTimeOfDaySelect,
  onPrecisionChange,
  onSeasonChange,
  onToggleApproximate,
  onEndYearChange,
  onEndMonthChange,
  copyDateFromPrevious,
  copyContextFromPrevious,
  addParticipant,
  removeParticipant,
  handleParticipantBackspace,
  onDateFieldsChange,
  onCalendarChange,
  toggleDatePicker,
  effectiveArcs,
  onArcsUpdate
} = usePromiseCardMeta(props, emit);
</script>
