<template>
  <section class="section-card">
    <header class="section-header">
      <div>
        <div class="section-title">📅 Дни недели</div>
        <div class="section-desc">
          Названия, порядок и количество дней в неделе. Задайте любой цикл (от 3 до 14+ дней).
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="status-chip">{{ weekdays.length }} дней в цикле</span>
      </div>
    </header>

    <div style="margin-top: 10px;">
      <!-- Готовые пресеты циклов недели -->
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Готовые пресеты циклов недели</label>
        <div class="chip-list">
          <button
            type="button"
            class="preset-chip"
            :class="{ active: weekdays.length === 7 }"
            :disabled="isReadOnly"
            @click="$emit('apply-week-preset', 7)"
          >
            🌍 7 дней (Земной: Пн-Вс)
          </button>
          <button
            type="button"
            class="preset-chip"
            :class="{ active: weekdays.length === 6 }"
            :disabled="isReadOnly"
            @click="$emit('apply-week-preset', 6)"
          >
            🏰 6 дней (Гексада фэнтези)
          </button>
          <button
            type="button"
            class="preset-chip"
            :class="{ active: weekdays.length === 10 }"
            :disabled="isReadOnly"
            @click="$emit('apply-week-preset', 10)"
          >
            🏛️ 10 дней (Декада Египта)
          </button>
          <button
            type="button"
            class="preset-chip"
            :class="{ active: weekdays.length === 5 }"
            :disabled="isReadOnly"
            @click="$emit('apply-week-preset', 5)"
          >
            ⏳ 5 дней (Пятидневка)
          </button>
        </div>
      </div>

      <!-- Список дней недели -->
      <div class="form-group">
        <label class="form-label">Порядок и названия дней в цикле</label>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div
            v-for="(wd, idx) in weekdays"
            :key="idx"
            class="weekday-row"
          >
            <span class="weekday-num">{{ idx + 1 }}</span>
            <input
              v-model="wd.название"
              type="text"
              class="weekday-input"
              :disabled="isReadOnly"
            />
            <button
              v-if="!isReadOnly"
              type="button"
              class="btn-icon-table"
              title="Вверх"
              :disabled="idx === 0"
              @click="$emit('reorder-weekday', idx, -1)"
            >
              ↑
            </button>
            <button
              v-if="!isReadOnly"
              type="button"
              class="btn-icon-table"
              title="Вниз"
              :disabled="idx === weekdays.length - 1"
              @click="$emit('reorder-weekday', idx, 1)"
            >
              ↓
            </button>
            <button
              v-if="!isReadOnly && weekdays.length > 1"
              type="button"
              class="btn-icon-table"
              title="Удалить день"
              @click="$emit('remove-weekday', idx)"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- Строка добавления своего произвольного дня -->
        <div v-if="!isReadOnly" style="display: flex; gap: 8px; margin-top: 10px; align-items: center;">
          <input
            :value="newWeekdayName"
            type="text"
            class="form-input"
            style="flex: 1;"
            placeholder="Название нового дня (например: Солнцевень, Ветродень, Лунь)..."
            @input="$emit('update:new-weekday-name', ($event.target as HTMLInputElement).value)"
            @keydown.enter="$emit('add-new-day')"
          />
          <button
            type="button"
            class="btn-action btn-primary"
            style="white-space: nowrap; padding: 8px 14px;"
            @click="$emit('add-new-day')"
          >
            ➕ Добавить свой день
          </button>
        </div>

        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: var(--text-muted)">Кликните на название дня для переименования, стрелками ↑ ↓ меняйте порядок.</span>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input
              type="checkbox"
              :checked="pauseOnHolidays"
              :disabled="isReadOnly"
              style="accent-color: var(--accent-primary);"
              @change="$emit('set-pause-on-holidays', ($event.target as HTMLInputElement).checked)"
            />
            <span>⏸️ Замораживать счет дней недели на время праздников</span>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CalendarWeekday, WeekPreset } from '../Tab1Structure.model';

defineProps<{
  weekdays: CalendarWeekday[];
  newWeekdayName: string;
  pauseOnHolidays?: boolean;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'apply-week-preset', preset: WeekPreset): void;
  (e: 'reorder-weekday', idx: number, dir: -1 | 1): void;
  (e: 'remove-weekday', idx: number): void;
  (e: 'update:new-weekday-name', name: string): void;
  (e: 'add-new-day'): void;
  (e: 'set-pause-on-holidays', val: boolean): void;
}>();
</script>
