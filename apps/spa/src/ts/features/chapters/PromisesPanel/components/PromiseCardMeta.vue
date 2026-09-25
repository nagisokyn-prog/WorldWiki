<template>
  <div class="promise-card-meta p-2.5 bg-surface-subtle border-b border-subtle flex flex-col gap-2.5 text-xs">
    <!-- 1. Локация (Гибридный ввод: Сущность ИЛИ произвольный текст) -->
    <div class="meta-row flex items-center gap-1.5">
      <span class="meta-icon text-accent text-sm" title="Локация действия">📍</span>
      <input
        v-model="locationDraft"
        type="text"
        :list="`locations-list-${item.id || 'new'}`"
        placeholder="Локация (выберите или введите текст)..."
        class="meta-input-field flex-1"
        @blur="saveLocation"
        @keydown.enter="saveLocation"
      />
      <datalist :id="`locations-list-${item.id || 'new'}`">
        <option v-for="loc in projectLocations" :key="loc.id" :value="loc.name">
          {{ loc.name }} (сущность)
        </option>
      </datalist>

      <span v-if="item.block_id" class="badge-block font-mono text-xs text-muted py-1 px-2 bg-panel rounded border border-border flex-shrink-0" title="Идентификатор блока">
        🧱 {{ item.block_id }}
      </span>
    </div>

    <!-- 2. Сюжетная Арка и Фаза -->
    <div class="meta-row flex items-center gap-2">
      <div class="meta-field flex items-center gap-1.5 flex-1 min-w-0">
        <span class="meta-icon text-accent text-sm" title="Сюжетная арка">🎭</span>
        <select
          v-model="localArcId"
          class="meta-select-input flex-1 truncate"
          title="Привязка к сюжетной арке"
          @change="onArcChange"
        >
          <option :value="null">— без арки —</option>
          <option v-for="arc in availableArcs" :key="arc.id || arc.title" :value="arc.id">
            {{ arc.title }}
          </option>
        </select>
      </div>

      <div v-if="localArcId" class="meta-field flex items-center gap-1.5 flex-1 min-w-0">
        <span class="meta-icon text-accent text-sm" title="Фаза сюжетной арки">📈</span>
        <select
          v-model="localArcPhase"
          class="meta-select-input flex-1 truncate"
          title="Фаза в рамках арки"
          @change="onArcChange"
        >
          <option value="setup">🌱 Завязка</option>
          <option value="escalation">⚡ Эскалация</option>
          <option value="climax">🔥 Кульминация</option>
          <option value="resolution">✅ Развязка</option>
        </select>
      </div>
    </div>

    <!-- 3. Участники сцены/блока -->
    <PromiseCardParticipants
      v-model:participant-input-query="participantInputQuery"
      :current-participants="currentParticipants"
      :is-participant-dropdown-open="isParticipantDropdownOpen"
      :available-characters="availableCharacters"
      :get-participant-display-name="getParticipantDisplayName"
      @open-dropdown="isParticipantDropdownOpen = true"
      @add-participant="addParticipant"
      @remove-participant="removeParticipant"
      @backspace="handleParticipantBackspace"
    />

    <!-- 4. Время действия сцены -->
    <PromiseCardTimeline
      :is-date-picker-open="isDatePickerOpen"
      :diegetic-info="diegeticInfo"
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
import PromiseCardParticipants from './PromiseCardParticipants.vue';
import PromiseCardTimeline from './PromiseCardTimeline.vue';
import { usePromiseCardMeta } from './usePromiseCardMeta';
import type { PromiseCardMetaProps, PromiseCardMetaEmits } from './PromiseCardMeta.model';

const props = defineProps<PromiseCardMetaProps>();
const emit = defineEmits<PromiseCardMetaEmits>();

const {
  locationDraft,
  participantInputQuery,
  isParticipantDropdownOpen,
  isDatePickerOpen,
  availableArcs,
  localArcId,
  localArcPhase,
  currentParticipants,
  availableCharacters,
  getParticipantDisplayName,
  projectLocations,
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
  saveLocation,
  addParticipant,
  removeParticipant,
  handleParticipantBackspace,
  onDateFieldsChange,
  toggleDatePicker,
  onArcChange
} = usePromiseCardMeta(props, emit);
</script>
