<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">🍂 Времена года (Сезоны)</div>
        <div class="section-desc">Границы климатических сезонов культуры. Выберите месяцы, принадлежащие каждому сезону.</div>
      </div>
      <button
        v-if="!isReadOnly"
        type="button"
        class="btn-ghost-sm"
        @click="$emit('add-season')"
      >
        + Добавить сезон
      </button>
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div
        v-for="(s, idx) in seasons"
        :key="idx"
        class="season-row-wrap"
        style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 12px;"
      >
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
          <input
            v-model="s.цвет"
            type="color"
            style="width: 26px; height: 26px; border: none; background: transparent; cursor: pointer;"
            title="Цвет сезона"
            :disabled="isReadOnly"
            @input="$emit('update-seasons', [...seasons])"
          />
          <input
            v-model="s.название"
            type="text"
            class="table-input"
            style="font-weight: 600; width: 160px;"
            :disabled="isReadOnly"
            @input="$emit('update-seasons', [...seasons])"
          />
          <button
            type="button"
            class="btn-ghost-sm"
            :disabled="isReadOnly"
            @click="toggleHemisphere(s)"
          >
            {{ s.hemisphere === 'southern' ? '🌍 Южное полушарие' : '🌍 Северное полушарие' }}
          </button>
          <span class="status-chip" style="margin-left: auto; font-size: 11px;">
            Выбрано: {{ (s.месяцы || []).length }} мес.
          </span>
          <button
            v-if="!isReadOnly && seasons.length > 1"
            type="button"
            class="btn-icon-table"
            title="Удалить сезон"
            @click="$emit('remove-season', idx)"
          >
            🗑️
          </button>
        </div>

        <!-- Интерактивная сетка выбора месяцев -->
        <div class="chip-list">
          <span
            v-for="(m, mIdx) in months"
            :key="mIdx"
            class="preset-chip"
            :class="{ active: (s.месяцы || []).includes(mIdx) }"
            style="cursor: pointer;"
            @click="toggleMonthInSeason(s, mIdx)"
          >
            {{ mIdx + 1 }}. {{ m.название || `Месяц ${mIdx + 1}` }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab3SeasonsSectionProps, Tab3SeasonsSectionEmits } from './Tab3SeasonsSection.model';
import type { CalendarMonth } from '@/services/Calendars/calendar.types';
import type { CultureSeasonDto } from '../Tab3CultureLore.model';
import { useTab3SeasonsSection } from './useTab3SeasonsSection';

const props = defineProps<Tab3SeasonsSectionProps>>();

const emit = defineEmits<Tab3SeasonsSectionEmits>>();

const { toggleHemisphere, toggleMonthInSeason } = useTab3SeasonsSection(props, (e, list) => emit(e, list));
</script>
