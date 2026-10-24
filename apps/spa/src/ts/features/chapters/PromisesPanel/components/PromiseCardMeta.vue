<template>
  <div class="promise-card-meta p-2.5 bg-surface-subtle border-b border-subtle flex flex-col gap-2.5 text-xs">
    <!-- 1. Локация (Гибридный ввод: Сущность ИЛИ произвольный текст) -->
    <div class="meta-row flex items-center gap-1.5 relative">
      <span class="meta-icon text-accent text-sm flex-shrink-0" title="Локация действия">📍</span>
      
      <div 
        class="tags-input-container interactive-el flex-1 relative flex items-center"
        @click="focusLocationInput"
      >
        <!-- Если локация выбрана: показываем чип с возможностью удаления -->
        <div v-if="item.location_id" class="tag-pill">
          <span>📍</span>
          <span class="font-medium">{{ getLocationDisplayName(item.location_id) }}</span>
          <button
            type="button"
            class="tag-remove"
            title="Очистить локацию"
            @mousedown.stop
            @click.stop="clearLocation"
          >
            ✕
          </button>
        </div>

        <!-- Если локация не выбрана: гибридный ввод с выпадающим списком -->
        <input
          v-else
          ref="locationInputRef"
          v-model="locationDraft"
          type="text"
          placeholder="Локация (выберите или введите текст)..."
          class="tags-input"
          @focus="isLocationDropdownOpen = true"
          @keydown.enter.prevent="selectLocation(locationDraft)"
          @keydown.esc="isLocationDropdownOpen = false"
        />

        <div 
          v-if="isLocationDropdownOpen" 
          class="character-dropdown shadow-dropdown"
        >
          <div class="flex items-center justify-between px-2 py-1 border-b border-subtle text-xs text-muted">
            <span>Выберите локацию:</span>
            <button type="button" class="btn-ghost-xs text-muted hover:text-main" @click.stop="isLocationDropdownOpen = false">✕ Скрыть</button>
          </div>

          <div
            v-for="loc in filteredLocations"
            :key="loc.id"
            class="char-option interactive-el"
            @mousedown.prevent="selectLocation(loc.name)"
          >
            <span class="text-accent text-xs">📍</span>
            <span class="font-medium flex-1 text-main">{{ loc.name }}</span>
            <span class="text-xs text-muted">сущность</span>
          </div>

          <div
            v-if="locationDraft.trim() && !filteredLocations.some(l => l.name.toLowerCase() === locationDraft.trim().toLowerCase())"
            class="char-option create-custom-option interactive-el"
            @mousedown.prevent="selectLocation(locationDraft)"
          >
            <span>＋</span>
            <span>Использовать «{{ locationDraft.trim() }}»</span>
          </div>

          <div v-if="filteredLocations.length === 0 && !locationDraft.trim()" class="p-2 text-xs text-muted text-center">
            Локации не созданы в проекте
          </div>
        </div>
      </div>

      <span v-if="item.block_id" class="badge-block font-mono text-xs text-muted py-1 px-2 bg-panel rounded border border-border flex-shrink-0" title="Идентификатор блока">
        🧱 {{ item.block_id }}
      </span>
    </div>

    <!-- 2. Сюжетные Арки и Фазы (Мульти-привязка к аркам сцены) -->
    <PromiseCardArcTags
      :project="project"
      :arcs="item.arcs"
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
      :is-date-picker-open="isDatePickerOpen"
      :diegetic-info="diegeticInfo"
      :calendars="calendars"
      :current-calendar-id="currentCalendarId"
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
      @toggle-picker="toggleDatePicker"
      @update:current-calendar-id="onCalendarChange"
      @update:current-era-idx="currentEraIdx = $event"
      @update:current-year="currentYear = $event"
      @update:current-month-idx="currentMonthIdx = $event"
      @update:current-day="currentDay = $event"
      @update:current-hour="currentHour = $event"
      @update:current-minute="currentMinute = $event"
      @change="onDateFieldsChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PromiseCardArcTags from './PromiseCardArcTags.vue';
import PromiseCardParticipants from './PromiseCardParticipants.vue';
import PromiseCardTimeline from './PromiseCardTimeline.vue';
import { usePromiseCardMeta } from './usePromiseCardMeta';
import type { PromiseCardMetaProps, PromiseCardMetaEmits } from './PromiseCardMeta.model';

const props = defineProps<PromiseCardMetaProps>();
const emit = defineEmits<PromiseCardMetaEmits>();

const locationInputRef = ref<HTMLInputElement | null>(null);
const focusLocationInput = () => {
  if (!props.item.location_id) {
    locationInputRef.value?.focus();
    isLocationDropdownOpen.value = true;
  }
};

const {
  locationDraft,
  isLocationDropdownOpen,
  filteredLocations,
  getLocationDisplayName,
  selectLocation,
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
  currentEraIdx,
  currentYear,
  currentMonthIdx,
  currentDay,
  currentHour,
  currentMinute,
  diegeticInfo,
  addParticipant,
  removeParticipant,
  handleParticipantBackspace,
  onDateFieldsChange,
  onCalendarChange,
  toggleDatePicker,
  onArcsUpdate
} = usePromiseCardMeta(props, emit);
</script>
