<template>
  <div class="tracker-toolbar">
    <!-- Срез: Ружья vs Артефакты vs Все -->
    <div class="scope-segmented-control">
      <button
        type="button"
        class="scope-btn"
        :class="{ 'is-active': filter.scope === 'guns' }"
        @click="onScopeClick('guns')"
      >
        <span>🗡️ Ружья</span>
        <span class="scope-badge">{{ gunsCount }}</span>
      </button>

      <button
        type="button"
        class="scope-btn"
        :class="{ 'is-active': filter.scope === 'items' }"
        @click="onScopeClick('items')"
      >
        <span>📦 Артефакты</span>
        <span class="scope-badge">{{ itemsCount }}</span>
      </button>

      <button
        type="button"
        class="scope-btn"
        :class="{ 'is-active': filter.scope === 'all' }"
        @click="onScopeClick('all')"
      >
        <span>🌐 Все</span>
        <span class="scope-badge">{{ totalCount }}</span>
      </button>
    </div>

    <div class="toolbar-filters">
      <!-- Volume Select -->
      <select
        v-if="volumeOptions && volumeOptions.length > 1"
        v-model="filter.selectedVolumeId"
        class="filter-select"
        title="Фильтр по томам"
      >
        <option v-for="v in volumeOptions" :key="v.id" :value="v.id">📚 {{ v.title }}</option>
      </select>

      <!-- Search Input -->
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="filter.search"
          type="text"
          :placeholder="filter.scope === 'guns' ? 'Поиск ружей или участников...' : 'Поиск по названию или владельцу...'"
          class="search-input"
        />
      </div>

      <!-- Type Select -->
      <select
        v-if="itemTypes.length > 0"
        v-model="filter.itemType"
        class="filter-select"
      >
        <option value="all">Все категории</option>
        <option v-for="t in itemTypes" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- Usage State Select -->
      <select
        v-model="filter.usageState"
        class="filter-select"
      >
        <option value="all">Все статусы</option>
        <option value="active">{{ filter.scope === 'guns' ? '🟢 Заряжено / Выстрелило' : '🟢 В сюжете (активные)' }}</option>
        <option value="sleeping">{{ filter.scope === 'guns' ? '🟡 Ждёт выстрела (5+ глав)' : '🟡 В ожидании (спят)' }}</option>
        <option value="forgotten">{{ filter.scope === 'guns' ? '🔴 Забытые ружья (10+ глав)' : '🔴 Забытые артефакты' }}</option>
        <option value="destroyed">{{ filter.scope === 'guns' ? '⚪ Сорванные / Снятые' : '⚪ Выбывшие' }}</option>
      </select>

      <button
        v-if="filter.search || filter.itemType !== 'all' || filter.usageState !== 'all'"
        class="btn-reset-filters"
        @click="onResetClick"
      >
        Сбросить фильтры
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChekhovTrackerToolbarProps, ChekhovTrackerToolbarEmits } from './ChekhovTrackerToolbar.model';
import { useChekhovTrackerToolbar } from './useChekhovTrackerToolbar';

const props = defineProps<ChekhovTrackerToolbarProps>();
const emit = defineEmits<ChekhovTrackerToolbarEmits>();

const { onScopeClick, onResetClick } = useChekhovTrackerToolbar(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>

