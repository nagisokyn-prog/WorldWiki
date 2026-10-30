<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">🎉 Праздники и Памятные даты культуры</div>
        <div class="section-desc">Ежегодные праздники (однодневные или многодневные периоды). Отображаются на календарной сетке и в тексте книги.</div>
      </div>
      <button
        v-if="!isReadOnly"
        type="button"
        class="btn-ghost-sm"
        @click="$emit('add-holiday')"
      >
        + Добавить праздник
      </button>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div
        v-for="(h, idx) in holidays"
        :key="idx"
        class="holiday-row-wrap"
        style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;"
      >
        <input
          v-model="h.название"
          type="text"
          class="table-input"
          style="font-weight: 600; width: 180px;"
          placeholder="Название праздника"
          :disabled="isReadOnly"
          @input="$emit('update-holidays', [...holidays])"
        />

        <button
          type="button"
          class="btn-ghost-sm"
          :style="h.is_range ? 'color: var(--accent-purple); border-color: var(--accent-purple);' : ''"
          :disabled="isReadOnly"
          @click="toggleRange(h)"
        >
          {{ h.is_range ? '📆 Период' : '📅 1 день' }}
        </button>

        <div style="display: flex; gap: 6px; align-items: center;">
          <span v-if="h.is_range" style="font-size: 11px; color: var(--text-muted)">С:</span>
          <select
            v-model.number="h.дата_начала.месяц"
            class="form-select"
            style="padding: 4px 8px; font-size: 12px;"
            :disabled="isReadOnly"
            @change="$emit('update-holidays', [...holidays])"
          >
            <option v-for="(m, mIdx) in months" :key="mIdx" :value="mIdx">
              {{ m.название || `Месяц ${mIdx + 1}` }}
            </option>
          </select>
          <input
            v-model.number="h.дата_начала.день"
            type="number"
            class="form-input"
            style="width: 55px; padding: 4px 6px;"
            min="1"
            max="31"
            :disabled="isReadOnly"
            @input="$emit('update-holidays', [...holidays])"
          />

          <template v-if="h.is_range">
            <span style="font-size: 11px; color: var(--text-muted)">по:</span>
            <select
              v-model.number="h.дата_конца!.месяц"
              class="form-select"
              style="padding: 4px 8px; font-size: 12px;"
              :disabled="isReadOnly"
              @change="$emit('update-holidays', [...holidays])"
            >
              <option v-for="(m, mIdx) in months" :key="mIdx" :value="mIdx">
                {{ m.название || `Месяц ${mIdx + 1}` }}
              </option>
            </select>
            <input
              v-model.number="h.дата_конца!.день"
              type="number"
              class="form-input"
              style="width: 55px; padding: 4px 6px;"
              min="1"
              max="31"
              :disabled="isReadOnly"
              @input="$emit('update-holidays', [...holidays])"
            />
          </template>
        </div>

        <span
          class="status-chip"
          :class="h.is_range ? '' : 'success'"
          :style="h.is_range ? 'background: rgba(168,85,247,0.15); color: var(--accent-purple); margin-left: auto; font-size: 11px;' : 'margin-left: auto; font-size: 11px;'"
        >
          {{ h.is_range ? 'Период (дней)' : '1 день' }}
        </span>

        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-icon-table"
          title="Удалить праздник"
          @click="$emit('remove-holiday', idx)"
        >
          🗑️
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab3HolidaysSectionProps, Tab3HolidaysSectionEmits } from './Tab3HolidaysSection.model';
import type { CalendarMonth } from '@/services/Calendars/calendar.types';
import type { CultureHolidayDto } from '../Tab3CultureLore.model';
import { useTab3HolidaysSection } from './useTab3HolidaysSection';

const props = defineProps<Tab3HolidaysSectionProps>>();

const emit = defineEmits<Tab3HolidaysSectionEmits>>();

const { toggleRange } = useTab3HolidaysSection(props, (e, list) => emit(e, list));
</script>
