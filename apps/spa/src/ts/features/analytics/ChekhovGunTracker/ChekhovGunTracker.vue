<template>
  <div class="chekhov-gun-tracker-root flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- 1. Header с панелью сводки и кнопкой обновления -->
    <div class="tracker-header p-4 border-b border-border bg-card/50 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-primary/10 text-primary text-xl">
          🗡️
        </div>
        <div>
          <h2 class="text-base font-bold text-main flex items-center gap-2">
            Трекер Чеховских Ружей и Инвентаря
          </h2>
          <p class="text-xs text-muted">
            Контроль судьбы артефактов, забытых предметов и цепочек владения
          </p>
        </div>
      </div>

      <!-- Счетчики и обновление -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 text-xs bg-surface-hover px-3 py-1.5 rounded-lg border border-border">
          <span class="text-muted">Всего:</span>
          <span class="font-bold text-main">{{ summary.total_items }}</span>
          <span class="text-muted mx-1">|</span>
          <span class="text-success font-semibold">🟢 {{ summary.active_count }}</span>
          <span class="text-warning font-semibold">🟡 {{ summary.sleeping_count }}</span>
          <span class="text-danger font-semibold">🔴 {{ summary.forgotten_count }}</span>
        </div>

        <button
          class="btn-refresh px-3 py-1.5 rounded-md font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all border border-border bg-surface-hover hover:bg-hover"
          :disabled="isLoading"
          @click="loadData(true)"
        >
          <span :class="{ 'animate-spin': isLoading }">🔄</span>
          <span>{{ isLoading ? 'Анализ...' : 'Обновить' }}</span>
        </button>
      </div>
    </div>

    <!-- 2. Панель фильтрации и поиска -->
    <div class="tracker-toolbar p-3 border-b border-border bg-surface/50 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[180px] max-w-xs">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">🔍</span>
          <input
            v-model="filter.search"
            type="text"
            placeholder="Поиск по названию или владельцу..."
            class="w-full pl-7 pr-3 py-1 text-xs rounded-md border border-border bg-input text-main focus:outline-hidden focus:border-primary transition-all"
          />
        </div>

        <!-- Type Select -->
        <select
          v-model="filter.itemType"
          class="px-2 py-1 text-xs rounded-md border border-border bg-input text-main focus:outline-hidden focus:border-primary transition-all"
        >
          <option value="all">Все типы предметов</option>
          <option v-for="t in itemTypes" :key="t" :value="t">{{ t }}</option>
        </select>

        <!-- Usage State Select -->
        <select
          v-model="filter.usageState"
          class="px-2 py-1 text-xs rounded-md border border-border bg-input text-main focus:outline-hidden focus:border-primary transition-all"
        >
          <option value="all">Все статусы</option>
          <option value="active">🟢 В сюжете (активные)</option>
          <option value="sleeping">🟡 В ожидании (спят)</option>
          <option value="forgotten">🔴 Забытые ружья</option>
          <option value="destroyed">⚪ Выбывшие</option>
        </select>
      </div>

      <button
        v-if="filter.search || filter.itemType !== 'all' || filter.usageState !== 'all'"
        class="text-xs text-muted hover:text-main underline cursor-pointer"
        @click="resetFilter"
      >
        Сбросить фильтры
      </button>
    </div>

    <!-- 3. Канбан 3 колонок (Активные, Спят, Забыты) -->
    <div class="tracker-body flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-4">
      <!-- Колонка 1: В сюжете -->
      <GunStatusColumn
        title="В сюжете (Активные)"
        icon="🟢"
        state-key="active"
        :items="activeItems"
        color-class="bg-success/20 text-success border border-success/30"
        @view-journey="openJourney"
      />

      <!-- Колонка 2: В спящем режиме -->
      <GunStatusColumn
        title="Ждут своего часа (Спят)"
        icon="🟡"
        state-key="sleeping"
        :items="sleepingItems"
        color-class="bg-warning/20 text-warning border border-warning/30"
        @view-journey="openJourney"
      />

      <!-- Колонка 3: Забытые ружья -->
      <GunStatusColumn
        title="Забытые ружья (10+ глав)"
        icon="🔴"
        state-key="forgotten"
        :items="forgottenItems"
        color-class="bg-danger/20 text-danger border border-danger/30"
        @view-journey="openJourney"
      />

      <!-- Колонка 4: Выбывшие (Уничтожены / Утеряны) -->
      <GunStatusColumn
        v-if="destroyedItems.length > 0"
        title="Выбыли из сюжета"
        icon="⚪"
        state-key="destroyed"
        :items="destroyedItems"
        color-class="bg-surface-hover text-muted border border-border"
        @view-journey="openJourney"
      />
    </div>

    <!-- 4. Модалка пути артефакта -->
    <GunJourneyModal
      :is-open="isJourneyModalOpen"
      :is-loading="isJourneyLoading"
      :journey="selectedJourney"
      @close="closeJourneyModal"
      @jump-to-chapter="$emit('jump-to-chapter', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ChekhovGunTrackerProps, ChekhovGunTrackerEmits } from './ChekhovGunTracker.model';
import GunStatusColumn from './components/GunStatusColumn.vue';
import GunJourneyModal from './components/GunJourneyModal.vue';
import { useChekhovGunTracker } from './useChekhovGunTracker';

const props = defineProps<ChekhovGunTrackerProps>();
defineEmits<ChekhovGunTrackerEmits>();

const {
  filter,
  summary,
  isLoading,
  itemTypes,
  activeItems,
  sleepingItems,
  forgottenItems,
  destroyedItems,
  selectedJourney,
  isJourneyModalOpen,
  isJourneyLoading,
  loadData,
  openJourney,
  closeJourneyModal,
  resetFilter,
} = useChekhovGunTracker(props.projectId);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>
