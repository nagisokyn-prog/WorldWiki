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
    <div class="tracker-toolbar">
      <!-- Срез: Ружья vs Артефакты vs Все -->
      <div class="scope-segmented-control">
        <button
          type="button"
          class="scope-btn"
          :class="{ 'is-active': filter.scope === 'guns' }"
          @click="setScope('guns')"
        >
          <span>🗡️ Ружья</span>
          <span class="scope-badge">{{ gunsCount }}</span>
        </button>

        <button
          type="button"
          class="scope-btn"
          :class="{ 'is-active': filter.scope === 'items' }"
          @click="setScope('items')"
        >
          <span>📦 Артефакты</span>
          <span class="scope-badge">{{ itemsCount }}</span>
        </button>

        <button
          type="button"
          class="scope-btn"
          :class="{ 'is-active': filter.scope === 'all' }"
          @click="setScope('all')"
        >
          <span>🌐 Все</span>
          <span class="scope-badge">{{ totalCount }}</span>
        </button>
      </div>

      <div class="toolbar-filters">
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
          class="text-xs text-muted hover:text-main underline cursor-pointer ml-auto"
          @click="resetFilter"
        >
          Сбросить фильтры
        </button>
      </div>
    </div>

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
import type { ChekhovGunTrackerProps, ChekhovGunTrackerEmits, LocatePromisePayload } from './ChekhovGunTracker.model';
import GunStatusColumn from './components/GunStatusColumn.vue';
import GunJourneyModal from './components/GunJourneyModal.vue';
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
  handleLocateNode,
  setScope,
  resetFilter,
} = useChekhovGunTracker(props);

function onLocateNode(payload: LocatePromisePayload) {
  handleLocateNode(payload);
  emit('locate-promise', payload);
  emit('jump-to-chapter', payload.chapterId);
}
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>
