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
          <!-- Селектор цвета из палитры токенов дизайна (без черного цвета) -->
          <div style="display: flex; gap: 4px; align-items: center;" title="Цвет сезона">
            <button
              v-for="p in palettes"
              :key="p.id"
              type="button"
              :disabled="isReadOnly"
              :title="p.name"
              style="width: 18px; height: 18px; border-radius: var(--radius-round, 50%); border: 2px solid transparent; cursor: pointer; transition: transform 0.15s ease;"
              :style="{
                background: p.cssVar,
                borderColor: s.цвет === p.cssVar ? 'var(--text-main)' : 'transparent',
                transform: s.цвет === p.cssVar ? 'scale(1.2)' : 'scale(1)',
              }"
              @click="setSeasonColor(s, p.cssVar)"
            ></button>
          </div>

          <input
            v-model="s.название"
            type="text"
            class="table-input"
            style="font-weight: 600; width: 160px;"
            :disabled="isReadOnly"
            @input="$emit('update-seasons', [...seasons])"
          />

          <!-- Переключатель полушария с тултипом (Пункт 12) -->
          <button
            type="button"
            class="btn-ghost-sm"
            :disabled="isReadOnly"
            title="В Южном полушарии планеты сезоны противоположны Северному: декабрь-февраль — это лето, а июнь-август — зима."
            @click="toggleHemisphere(s)"
          >
            {{ s.hemisphere === 'southern' ? '🌍 Южное полушарие' : '🌍 Северное полушарие' }}
            <span style="font-size: 11px; margin-left: 4px; opacity: 0.7;">ℹ️</span>
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
import {
  SEASON_PALETTES,
  type Tab3SeasonsSectionProps,
  type Tab3SeasonsSectionEmits,
} from './Tab3SeasonsSection.model';
import type { CultureSeasonDto } from '../Tab3CultureLore.model';
import { useTab3SeasonsSection } from './useTab3SeasonsSection';

const props = defineProps<Tab3SeasonsSectionProps>();

const emit = defineEmits<Tab3SeasonsSectionEmits>();

const palettes = SEASON_PALETTES;

const { toggleHemisphere, toggleMonthInSeason } = useTab3SeasonsSection(props, emit);

function setSeasonColor(s: CultureSeasonDto, colorVar: string) {
  if (props.isReadOnly) return;
  s.цвет = colorVar;
  emit('update-seasons', [...props.seasons]);
}
</script>
