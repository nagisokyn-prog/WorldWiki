<template>
  <div class="calendar-section">
    <div class="section-header seasons-section-header" @click="isCollapsed = !isCollapsed">
      <h4 class="m-0">🌤️ Сезоны</h4>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" class="mt-3">
      <div v-auto-animate class="item-list">
        <div
          v-for="(season, sIdx) in modelValue.сезоны"
          :key="sIdx"
          class="item-row season-row-wrap"
        >
          <div class="season-top-row">
            <input
              v-model="season.название"
              type="text"
              class="item-name season-name-input interactive-el"
              placeholder="Название сезона"
            />
            <div class="item-actions">
              <button
                class="btn-icon interactive-el"
                :disabled="Number(sIdx) === 0"
                @click.prevent="moveItem(Number(sIdx), -1)"
              >
                ↑
              </button>
              <button
                class="btn-icon interactive-el"
                :disabled="Number(sIdx) === (modelValue.сезоны?.length || 0) - 1"
                @click.prevent="moveItem(Number(sIdx), 1)"
              >
                ↓
              </button>
              <button
                class="btn-icon interactive-el"
                @click.prevent="removeSeason(Number(sIdx))"
              >
                🗑️
              </button>
            </div>
          </div>
          <div>
            <div class="season-months-grid">
              <label
                v-for="(m, mIdx) in modelValue.месяцы || []"
                :key="mIdx"
                class="interactive-el month-pill-label"
                :class="{ 'is-selected': season.месяцы && season.месяцы.includes(mIdx) }"
              >
                <input
                  v-model="season.месяцы"
                  type="checkbox"
                  :value="mIdx"
                  class="hidden"
                />
                {{ m.название }}
              </label>
            </div>
            <div
              v-if="!season.месяцы || season.месяцы.length === 0"
              class="season-warning"
            >
              ⚠️ Выберите месяцы для сезона
            </div>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addSeason">➕ Добавить сезон</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarSeasons } from './useCalendarSeasons';
import type { CalendarSeasonsProps } from './useCalendarSeasons';

const props = defineProps<CalendarSeasonsProps>();

const { isCollapsed, moveItem, addSeason, removeSeason } = useCalendarSeasons(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarSeasons.css"></style>

