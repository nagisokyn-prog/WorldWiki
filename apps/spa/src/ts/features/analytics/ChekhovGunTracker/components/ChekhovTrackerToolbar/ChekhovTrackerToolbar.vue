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
      <XboxWheel
        v-if="volumeOptions && volumeOptions.length > 1"
        v-model="filter.selectedVolumeId"
        :options="volumeWheelOptions"
        title="Фильтр по томам"
      />

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
      <XboxWheel
        v-if="itemTypes.length > 0"
        v-model="filter.itemType"
        :options="itemTypeWheelOptions"
      />

      <!-- Usage State Select -->
      <XboxWheel
        v-model="filter.usageState"
        :options="usageStateWheelOptions"
      />

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
import { XboxWheel } from '@worldwiki/components';
import type { ChekhovTrackerToolbarProps, ChekhovTrackerToolbarEmits } from './ChekhovTrackerToolbar.model';
import { useChekhovTrackerToolbar } from './useChekhovTrackerToolbar';

const props = defineProps<ChekhovTrackerToolbarProps>();
const emit = defineEmits<ChekhovTrackerToolbarEmits>();

const {
  volumeWheelOptions,
  itemTypeWheelOptions,
  usageStateWheelOptions,
  onScopeClick,
  onResetClick,
} = useChekhovTrackerToolbar(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>

