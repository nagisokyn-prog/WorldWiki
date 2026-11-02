<template>
  <div class="correction-subcard">
    <div
      class="correction-subcard-title"
      style="cursor: pointer; display: flex; align-items: center; justify-content: space-between;"
      @click="toggleCollapsed"
    >
      <span style="display: flex; align-items: center; gap: 6px;">
        <span>✨</span> Дни вне месяцев (Ежегодные праздники)
        <span class="text-xs text-muted" style="font-size: 11px; margin-left: 6px;">
          {{ extraDaysCount }} сут. в обычный год
        </span>
      </span>
      <span class="text-xs text-muted" style="font-size: 12px;">
        {{ isCollapsed ? '▶ Развернуть' : '▼ Свернуть' }}
      </span>
    </div>

    <div v-show="!isCollapsed" style="margin-top: 10px;">
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

      <div class="grid-2 gap-3" style="margin-top: 8px;">
        <div class="form-group">
          <label class="form-label">Позиция в структуре года</label>
          <XboxWheel
            :model-value="placement"
            :options="placementOptions"
            @update:model-value="$emit('update-placement', $event as any)"
          />
        </div>
        <div v-if="placement === 'after_month'" class="form-group">
          <label class="form-label">После какого месяца вставлять</label>
          <XboxWheel
            :model-value="String(afterMonthIndex)"
            :options="monthOptions"
            @update:model-value="$emit('update-after-month', parseInt($event) || 0)"
          />
        </div>
      </div>

      <label class="glass-checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px; margin-top: 8px; cursor: pointer;">
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
      <div class="year-tape-container" style="margin-top: 10px;">
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
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { Tab1ExtraDaysTapeProps, Tab1ExtraDaysTapeEmits } from './Tab1ExtraDaysTape.model';
import { useTab1ExtraDaysTape } from './useTab1ExtraDaysTape';

const props = defineProps<Tab1ExtraDaysTapeProps>();

defineEmits<Tab1ExtraDaysTapeEmits>();

const { isCollapsed, placementOptions, monthOptions, toggleCollapsed } = useTab1ExtraDaysTape(props);
</script>
