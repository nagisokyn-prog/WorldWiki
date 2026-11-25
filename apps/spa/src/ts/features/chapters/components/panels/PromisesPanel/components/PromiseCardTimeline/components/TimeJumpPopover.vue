<template>
  <div class="time-jump-popover" @click.stop>
    <div class="time-jump-header">
      <span class="time-jump-title">Свой переход времени</span>
      <button type="button" class="time-jump-close" title="Закрыть" @click="$emit('close')">✕</button>
    </div>

    <div class="time-jump-sign-row">
      <button type="button" class="timeline-chip time-jump-sign-btn" :class="{ active: sign === 1 }" @click="sign = 1">
        ＋ Вперёд
      </button>
      <button type="button" class="timeline-chip time-jump-sign-btn" :class="{ active: sign === -1 }" @click="sign = -1">
        − Назад
      </button>
    </div>

    <div class="time-jump-grid">
      <label class="time-jump-field">
        <span>Лет</span>
        <input v-model.number="years" type="number" min="0" class="time-jump-input" @keydown.enter.prevent="applyOnce" />
      </label>
      <label class="time-jump-field">
        <span>Мес</span>
        <input v-model.number="months" type="number" min="0" class="time-jump-input" @keydown.enter.prevent="applyOnce" />
      </label>
      <label class="time-jump-field">
        <span>Дн</span>
        <input v-model.number="days" type="number" min="0" class="time-jump-input" @keydown.enter.prevent="applyOnce" />
      </label>
      <label v-for="u in subDayUnits" :key="u.key" class="time-jump-field">
        <span>{{ u.title }}</span>
        <input
          :value="dialValues[u.key] || 0"
          type="number"
          min="0"
          class="time-jump-input"
          @input="setDialValue(u.key, ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="applyOnce"
        />
      </label>
    </div>

    <input
      v-model="customLabel"
      type="text"
      class="time-jump-label-input"
      :placeholder="`Подпись (по умолч.: ${previewLabel})`"
      @keydown.enter.prevent="saveAndApply"
    />

    <div class="time-jump-actions">
      <button type="button" class="timeline-chip" :disabled="!hasAnyValue" @click="applyOnce">
        Применить
      </button>
      <button type="button" class="time-jump-save-btn" :disabled="!hasAnyValue" @click="saveAndApply">
        ＋ Сохранить чип
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TimeJumpPopoverProps, TimeJumpPopoverEmits } from './TimeJumpPopover.model';
import { useTimeJumpPopover } from './useTimeJumpPopover';

const props = defineProps<TimeJumpPopoverProps>();
const emit = defineEmits<TimeJumpPopoverEmits>();

const {
  sign, years, months, days, customLabel, dialValues,
  subDayUnits, hasAnyValue, previewLabel, setDialValue, applyOnce, saveAndApply
} = useTimeJumpPopover(props, emit);
</script>
