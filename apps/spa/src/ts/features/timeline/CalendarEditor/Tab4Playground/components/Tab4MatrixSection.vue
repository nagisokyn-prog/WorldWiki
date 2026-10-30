<template>
  <div class="section-card">
    <div class="section-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button
          type="button"
          class="btn-ghost-sm"
          title="Предыдущий месяц"
          @click="$emit('prev-month')"
        >
          ◀
        </button>
        <div class="section-title">
          {{ currentMonthTitle }} (Сетка стартового месяца)
        </div>
        <button
          type="button"
          class="btn-ghost-sm"
          title="Следующий месяц"
          @click="$emit('next-month')"
        >
          ▶
        </button>
      </div>
      <div style="display: flex; gap: 12px; font-size: 12px;">
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent-warning);"></span>
          Точка старта сюжета
        </span>
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent-purple);"></span>
          Праздник
        </span>
      </div>
    </div>

    <!-- Сетка дней недели -->
    <div class="calendar-matrix">
      <div
        v-for="(header, hIdx) in weekdayHeaders"
        :key="hIdx"
        class="matrix-day-header"
        :style="hIdx >= weekdayHeaders.length - 2 ? 'color: var(--accent-warning);' : ''"
      >
        {{ header }}
      </div>

      <div
        v-for="(d, idx) in monthMatrixDays"
        :key="d.isPadding ? `pad-${idx}` : d.day"
        class="matrix-day-cell"
        :class="{
          'is-padding': d.isPadding,
          'active': d.isSelected,
          'is-origin': d.isStoryOrigin,
          'is-holiday': d.isHoliday,
        }"
        :title="d.isStoryOrigin ? 'День начала сюжета произведения (Глава 1)!' : (d.isHoliday ? 'Праздничный день' : undefined)"
        @click="!d.isPadding && $emit('select-day', d.day)"
      >
        <!-- Пустой день-отступ -->
        <template v-if="d.isPadding">
          <div class="cell-top opacity-0">
            <span>&nbsp;</span>
          </div>
        </template>

        <!-- День старта сюжета -->
        <template v-else-if="d.isStoryOrigin">
          <div class="cell-top">
            <span style="color: var(--accent-warning); font-weight: 700;">{{ d.day }}</span>
            <span class="cell-badge" style="background: var(--accent-warning); color: #000; font-weight: 700;">
              Старт книги
            </span>
          </div>
          <div class="cell-sub" style="color: var(--accent-warning); font-weight: 600;">
            Глава 1
          </div>
        </template>

        <!-- Праздничный день -->
        <template v-else-if="d.isHoliday">
          <div class="cell-top">
            <span style="color: var(--accent-purple); font-weight: 700;">{{ d.day }}</span>
            <span class="cell-badge" style="background: rgba(168, 85, 247, 0.2); color: var(--accent-purple);">
              🌸 Праздник
            </span>
          </div>
          <div class="cell-sub">
            {{ d.holidayName || 'Праздник' }}
          </div>
        </template>

        <!-- Обычный день -->
        <template v-else>
          <div class="cell-top">
            <span>{{ d.day }}</span>
          </div>
          <div class="cell-sub">
            {{ d.weekdayShort }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab4MatrixSectionProps, Tab4MatrixSectionEmits } from './Tab4MatrixSection.model';

defineProps<Tab4MatrixSectionProps>();

defineEmits<Tab4MatrixSectionEmits>();
</script>
