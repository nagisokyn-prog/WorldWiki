<template>
  <div class="planet-editor">
    <!-- Dashboard карточка планеты -->
    <div class="dashboard-banner">
      <div class="dashboard-left">
        <div class="dashboard-title-row">
          <span id="planet-icon" class="dashboard-icon">{{ planet.icon || '🪐' }}</span>
          <input
            id="planet-name-input"
            v-model="planet.name"
            type="text"
            class="dashboard-title-input"
            placeholder="Название планеты"
            :disabled="isReadOnly"
            @input="updateName(($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="dashboard-tags">
          <span class="status-chip success">
            🌍 Сутки: <strong>{{ planet.day_hours }}ч {{ planet.day_minutes }}м</strong> ({{ planet.ticks_per_day }} тиков)
          </span>
          <span class="status-chip success">
            🪐 Орбита: <strong>{{ planet.orbit_days }} сут.</strong>
          </span>
          <span class="status-chip">
            📐 Наклон: <strong>{{ decimalAxialTilt }}°</strong>
          </span>
        </div>
      </div>

      <div class="dashboard-actions">
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-dashboard interactive-el"
          title="Библиотека астрофизических пресетов планет"
          @click="openPresetsModal"
        >
          ✨ Пресеты
        </button>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-dashboard btn-danger interactive-el"
          title="Удалить планету"
          @click="deletePlanet"
        >
          🗑️ Удалить
        </button>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-dashboard btn-save interactive-el"
          :disabled="isSaving"
          @click="savePlanet"
        >
          {{ isSaving ? '💾 Сохранение...' : '💾 Сохранить планету' }}
        </button>
      </div>
    </div>

    <!-- Индикатор ошибки -->
    <div v-if="errorMessage" class="error-banner mb-3 p-2 rounded bg-danger-subtle text-danger text-sm">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- Навигационные вкладки -->
    <nav class="planet-tabs-nav mb-4 flex gap-2 border-b border-subtle pb-2">
      <button
        type="button"
        class="tab-btn interactive-el"
        :class="{ active: activeTab === 'astrophysics' }"
        @click="setTab('astrophysics')"
      >
        <span>🪐 Орбита и сутки</span>
      </button>
      <button
        type="button"
        class="tab-btn interactive-el"
        :class="{ active: activeTab === 'timezones' }"
        @click="setTab('timezones')"
      >
        <span>🌍 Часовые пояса и регионы</span>
        <span class="tab-badge">{{ planet.timezones.length }}</span>
      </button>
      <button
        type="button"
        class="tab-btn interactive-el"
        :class="{ active: activeTab === 'moons' }"
        @click="setTab('moons')"
      >
        <span>🌕 Спутники и луны</span>
        <span class="tab-badge">{{ planet.moons.length }} лун</span>
      </button>
    </nav>

    <!-- ТАБ 1 ПЛАНЕТЫ: АСТРОФИЗИКА -->
    <PlanetAstrophysicsTab
      v-if="activeTab === 'astrophysics'"
      :planet="planet"
      :decimal-axial-tilt="decimalAxialTilt"
      :is-read-only="isReadOnly"
      @update:day-hours="planet.day_hours = $event; updateDayTicks()"
      @update:day-minutes="planet.day_minutes = $event; updateDayTicks()"
      @update:day-seconds="planet.day_seconds = $event; updateDayTicks()"
      @update:orbit-days="updateOrbitDays($event)"
      @update:rotation-direction="planet.rotation_direction = $event"
      @update:axial-tilt="decimalAxialTilt = $event"
      @recalculate-astro-points="recalculateAstroPoints"
    />

    <!-- ТАБ 2 ПЛАНЕТЫ: ПОЯСА И ГОРОДА -->
    <PlanetTimezonesTab
      v-else-if="activeTab === 'timezones'"
      :planet="planet"
      :is-read-only="isReadOnly"
      @apply-preset="applyTimezonePreset"
      @apply-regions-preset="applyRegionsPreset"
      @add-timezone="addTimezone"
      @remove-timezone="removeTimezone"
      @add-region="addRegion"
      @remove-region="removeRegion"
    />

    <!-- ТАБ 3 ПЛАНЕТЫ: СПУТНИКИ И ЛУНЫ -->
    <PlanetMoonsTab
      v-else-if="activeTab === 'moons'"
      :planet="planet"
      :is-read-only="isReadOnly"
      @add-moon="addMoon"
      @remove-moon="removeMoon"
    />

    <!-- Модалка пресетов планет -->
    <PlanetPresetsModal
      v-if="isPresetsModalOpen"
      :model-value="isPresetsModalOpen"
      @update:model-value="isPresetsModalOpen = $event"
      @select-preset="applyPreset"
    />
  </div>
</template>

<script setup lang="ts">
import type { PlanetEditorProps, PlanetEditorEmits } from './PlanetEditor.model';
import { usePlanetEditor } from './usePlanetEditor';
import PlanetAstrophysicsTab from './components/PlanetAstrophysicsTab/PlanetAstrophysicsTab.vue';
import PlanetTimezonesTab from './components/PlanetTimezonesTab/PlanetTimezonesTab.vue';
import PlanetMoonsTab from './components/PlanetMoonsTab/PlanetMoonsTab.vue';
import PlanetPresetsModal from './PlanetPresetsModal/PlanetPresetsModal.vue';

const props = defineProps<PlanetEditorProps>();
const emit = defineEmits<PlanetEditorEmits>();

const {
  activeTab,
  planet,
  decimalAxialTilt,
  isSaving,
  errorMessage,
  isPresetsModalOpen,
  openPresetsModal,
  applyPreset,
  setTab,
  updateName,
  updateDayTicks,
  updateOrbitDays,
  recalculateAstroPoints,
  applyTimezonePreset,
  applyRegionsPreset,
  addTimezone,
  removeTimezone,
  addRegion,
  removeRegion,
  addMoon,
  removeMoon,
  savePlanet,
  deletePlanet,
} = usePlanetEditor(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/timeline/PlanetEditor.css"></style>
