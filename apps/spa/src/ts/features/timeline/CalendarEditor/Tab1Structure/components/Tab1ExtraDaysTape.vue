<template>
  <div class="correction-subcard">
    <div class="correction-subcard-title">
      <span style="display: flex; align-items: center; gap: 6px;">
        <span>✨</span> Дни вне месяцев (Ежегодные праздники)
      </span>
      <span class="text-xs text-muted" style="font-size: 11px;">
        {{ extraDaysCount }} сут. в обычный год
      </span>
    </div>

    <div class="grid-2 gap-3">
      <div class="form-group">
        <label class="form-label">Дней вне месяцев</label>
        <input
          type="number"
          class="form-input"
          :value="extraDaysCount"
          min="0"
          :disabled="isReadOnly"
          @input="$emit('update-extra-days', parseInt(($event.target as HTMLInputElement).value) || 0)"
        />
      </div>
      <div class="form-group">
        <label class="form-label">Название блока праздников</label>
        <input
          type="text"
          class="form-input"
          :value="extraDaysName"
          placeholder="Праздники середины года / Йул / Лите"
          :disabled="isReadOnly"
          @input="$emit('update-extra-name', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="grid-2 gap-3" style="margin-top: 4px;">
      <div class="form-group">
        <label class="form-label">Позиция в структуре года</label>
        <select
          class="form-select"
          :value="placement"
          :disabled="isReadOnly"
          @change="$emit('update-placement', ($event.target as HTMLSelectElement).value as any)"
        >
          <option value="end_of_year">В конце года (после всех месяцев)</option>
          <option value="mid_year">В середине года (как у Толкина)</option>
          <option value="start_of_year">В начале года (перед 1-м месяцем)</option>
          <option value="after_month">После конкретного месяца...</option>
        </select>
      </div>
      <div v-if="placement === 'after_month'" class="form-group">
        <label class="form-label">После какого месяца вставлять</label>
        <select
          class="form-select"
          :value="afterMonthIndex"
          :disabled="isReadOnly"
          @change="$emit('update-after-month', parseInt(($event.target as HTMLSelectElement).value) || 0)"
        >
          <option v-for="(m, idx) in months" :key="idx" :value="idx">
            {{ m.название || `Месяц ${idx + 1}` }}
          </option>
        </select>
      </div>
    </div>

    <label class="glass-checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px; margin-top: 6px; cursor: pointer;">
      <input
        type="checkbox"
        :checked="pauseWeekdays"
        :disabled="isReadOnly"
        style="accent-color: var(--accent-primary);"
        @change="$emit('update-pause-weekdays', ($event.target as HTMLInputElement).checked)"
      />
      <span>⏸️ Замораживать счет дней недели на время праздников</span>
    </label>

    <!-- Наглядная интерактивная лента структуры года (Year Tape) -->
    <div class="year-tape-container">
      <div class="year-tape-title">🗓️ Лента структуры года (последовательность месяцев и праздников):</div>
      <div class="year-tape-scroll">
        <div
          v-for="(item, idx) in yearTape"
          :key="idx"
          class="tape-item"
          :class="{
            'tape-extra-days': item.type === 'extra_days',
            'tape-leap-target': item.isLeapTarget,
          }"
        >
          <span class="tape-item-name">{{ item.name }}</span>
          <span class="tape-item-days">
            {{ item.days }} дн.
            <span v-if="item.extraBadge" class="tape-leap-badge">{{ item.extraBadge }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab1ExtraDaysTapeProps, Tab1ExtraDaysTapeEmits } from './Tab1ExtraDaysTape.model';
import type { CalendarMonth } from '@/services/Calendars/calendar.types';
import type { YearTapeItem } from '../tab1Leap.utils';

defineProps<Tab1ExtraDaysTapeProps>();

defineEmits<Tab1ExtraDaysTapeEmits>();
</script>
