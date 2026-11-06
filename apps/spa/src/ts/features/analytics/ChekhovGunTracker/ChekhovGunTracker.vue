<template>
  <div class="chekhov-gun-tracker-root flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- 1. Header с панелью сводки и кнопкой обновления -->
    <div class="tracker-header">
      <div class="tracker-header-left">
        <div class="tracker-header-icon-box">
          {{ filter.scope === 'items' ? '📦' : '🗡️' }}
        </div>
        <div>
          <h2 class="tracker-header-title">
            {{ filter.scope === 'guns' ? 'Трекер Чеховских Ружей' : (filter.scope === 'items' ? 'Трекер Артефактов и Инвентаря' : 'Трекер Ружей и Артефактов') }}
          </h2>
          <p class="tracker-header-subtitle">
            {{ filter.scope === 'guns' ? 'Контроль драматургических обещаний, предзнаменований и выстрелов в сюжете' : (filter.scope === 'items' ? 'Контроль судьбы артефактов, забытых предметов и цепочек владения' : 'Сквозной контроль сюжетных обещаний и материального инвентаря') }}
          </p>
        </div>
      </div>

      <!-- Счетчики и обновление -->
      <div class="flex items-center gap-3">
        <div class="tracker-summary-pill">
          <span>Всего: <strong class="text-main">{{ summary.total_items }}</strong></span>
          <span class="text-muted">|</span>
          <span class="text-success font-semibold">🟢 {{ summary.active_count }}</span>
          <span class="text-warning font-semibold">🟡 {{ summary.sleeping_count }}</span>
          <span class="text-danger font-semibold">🔴 {{ summary.forgotten_count }}</span>
        </div>

        <button
          class="btn-refresh"
          :disabled="isLoading"
          @click="loadData(true)"
        >
          <span :class="{ 'animate-spin': isLoading }">🔄</span>
          <span>{{ isLoading ? 'Анализ...' : 'Обновить' }}</span>
        </button>
      </div>
    </div>

    <!-- 2. Панель фильтрации, переключения срезов и поиска -->
    <ChekhovTrackerToolbar
      :filter="filter"
      :guns-count="gunsCount"
      :items-count="itemsCount"
      :total-count="totalCount"
      :item-types="itemTypes"
      :volume-options="volumeOptions"
      @set-scope="setScope"
      @reset-filter="resetFilter"
    />

    <!-- 3. Канбан 3 колонок (Активные, Спят, Забыты) -->
    <div class="tracker-body flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-4">
      <!-- Колонка 1: В сюжете -->
      <GunStatusColumn
        :title="filter.scope === 'guns' ? 'Заряжено в сюжете' : 'В сюжете (Активные)'"
        icon="🟢"
        state-key="active"
        :items="activeItems"
        :scope="filter.scope"
        color-class="bg-success/20 text-success border border-success/30"
        @view-journey="openJourney"
      />

      <!-- Колонка 2: В спящем режиме -->
      <GunStatusColumn
        :title="filter.scope === 'guns' ? 'Ждут своего часа (Спят)' : 'Ждут своего часа (Спят)'"
        icon="🟡"
        state-key="sleeping"
        :items="sleepingItems"
        :scope="filter.scope"
        color-class="bg-warning/20 text-warning border border-warning/30"
        @view-journey="openJourney"
      />

      <!-- Колонка 3: Забытые ружья -->
      <GunStatusColumn
        :title="filter.scope === 'guns' ? 'Забытые ружья (10+ глав)' : 'Забытые артефакты (10+ глав)'"
        icon="🔴"
        state-key="forgotten"
        :items="forgottenItems"
        :scope="filter.scope"
        color-class="bg-danger/20 text-danger border border-danger/30"
        @view-journey="openJourney"
      />

      <!-- Колонка 4: Выбывшие (Уничтожены / Утеряны) -->
      <GunStatusColumn
        v-if="destroyedItems.length > 0"
        :title="filter.scope === 'guns' ? 'Сорванные / Снятые' : 'Выбыли из сюжета'"
        icon="⚪"
        state-key="destroyed"
        :items="destroyedItems"
        :scope="filter.scope"
        color-class="bg-surface-hover text-muted border border-border"
        @view-journey="openJourney"
      />
    </div>

    <!-- 4. Модалка пути артефакта -->
    <GunJourneyModal
      :is-open="isJourneyModalOpen"
      :is-loading="isJourneyLoading"
      :journey="selectedJourney"
      :active-item="selectedItem"
      @close="closeJourneyModal"
      @jump-to-chapter="$emit('jump-to-chapter', $event)"
      @locate-node="onLocateNode"
    />
  </div>
</template>

<script setup lang="ts">
import type { ChekhovGunTrackerProps, ChekhovGunTrackerEmits } from './ChekhovGunTracker.model';
import GunStatusColumn from './components/GunStatusColumn/GunStatusColumn.vue';
import GunJourneyModal from './components/GunJourneyModal/GunJourneyModal.vue';
import ChekhovTrackerToolbar from './components/ChekhovTrackerToolbar/ChekhovTrackerToolbar.vue';
import { useChekhovGunTracker } from './useChekhovGunTracker';

const props = withDefaults(
  defineProps<ChekhovGunTrackerProps>(),
  {
    projectId: '',
    project: '',
  }
);
const emit = defineEmits<ChekhovGunTrackerEmits>();

const {
  filter,
  summary,
  isLoading,
  volumeOptions,
  gunsCount,
  itemsCount,
  totalCount,
  itemTypes,
  activeItems,
  sleepingItems,
  forgottenItems,
  destroyedItems,
  selectedItem,
  selectedJourney,
  isJourneyModalOpen,
  isJourneyLoading,
  loadData,
  openJourney,
  closeJourneyModal,
  onLocateNode,
  setScope,
  resetFilter,
} = useChekhovGunTracker(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>
