<template>
  <div class="loc-astro-widget glass-card">
    <div class="loc-astro-header">
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold text-main">🧭 Географическая иерархия и астрономия</span>
        <span class="loc-astro-crumb">{{ scaleLabel }}</span>
        <span v-if="resolvedGeo.isStateCapital" class="loc-astro-crumb is-current">
          👑 Столица ({{ resolvedGeo.stateName || 'Государство' }})
        </span>
      </div>

      <div class="text-xs text-muted">
        <span v-if="resolvedGeo.isInherited">
          🔗 География унаследована от: <strong class="text-accent">{{ resolvedGeo.inheritedFromName }}</strong>
        </span>
        <span v-else-if="resolvedGeo.hasExplicitGeography">
          📍 Собственные координаты локации
        </span>
        <span v-else>
          🌐 Глобальные координаты по умолчанию (0°, UTC+0)
        </span>
      </div>
    </div>

    <!-- Иерархическая цепочка предков -->
    <div v-if="resolvedGeo.breadcrumbs.length > 1" class="loc-astro-breadcrumbs">
      <span>Иерархия:</span>
      <template v-for="(crumb, idx) in resolvedGeo.breadcrumbs" :key="crumb.id">
        <span
          class="loc-astro-crumb"
          :class="{ 'is-current': Number(idx) === resolvedGeo.breadcrumbs.length - 1 }"
        >
          {{ crumb.name }}
        </span>
        <span v-if="Number(idx) < resolvedGeo.breadcrumbs.length - 1">→</span>
      </template>
    </div>

    <!-- Сводные метрики географии и времени -->
    <div class="loc-astro-grid">
      <div class="loc-astro-metric">
        <div class="loc-astro-metric-label">Координаты (Широта / Долгота)</div>
        <div class="loc-astro-metric-value">{{ coordinatesLabel }}</div>
      </div>

      <div class="loc-astro-metric">
        <div class="loc-astro-metric-label">Эффективный часовой пояс</div>
        <div class="loc-astro-metric-value">
          {{ formattedOffset }}
          <span v-if="resolvedGeo.stateName && !resolvedGeo.isStateCapital" class="text-xs text-muted">
            ({{ resolvedGeo.stateName }})
          </span>
        </div>
      </div>

      <div class="loc-astro-metric">
        <div class="loc-astro-metric-label">Местное время (при {{ timeInfo.worldTimeStr }} UTC)</div>
        <div class="loc-astro-metric-value">
          {{ timeInfo.phaseEmoji }} {{ timeInfo.localTimeStr }} — {{ timeInfo.sunStatus.phase_label }}
        </div>
      </div>

      <div class="loc-astro-metric">
        <div class="loc-astro-metric-label">Световой день (Восход / Закат)</div>
        <div class="loc-astro-metric-value">
          🌅 {{ timeInfo.sunStatus.sunrise_time }} — 🌇 {{ timeInfo.sunStatus.sunset_time }}
          <span class="text-xs text-muted">({{ timeInfo.sunStatus.daylight_text }})</span>
        </div>
      </div>
    </div>

    <!-- Интерактивный симулятор времени суток -->
    <div class="loc-astro-sun-bar">
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted">Мировой час (UTC):</span>
        <input
          v-model.number="previewWorldHour"
          type="range"
          min="0"
          :max="maxHoursPerDay - 1"
          class="range-accent"
        />
        <span class="text-xs font-bold text-accent">{{ timeInfo.worldTimeStr }}</span>
      </div>

      <div v-if="availableSeasons.length > 0" class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-muted">Сезон:</span>
        <button
          v-for="s in availableSeasons"
          :key="s.name"
          type="button"
          class="loc-astro-tz-chip"
          @click="setSeasonDayPreset(s.startDay)"
        >
          {{ s.name }}
        </button>
      </div>
    </div>

    <!-- Быстрый выбор пояса из календаря мира -->
    <div v-if="availableTimezones.length > 0" class="loc-astro-tz-chips">
      <span class="text-xs text-muted">Быстрый выбор пояса мира:</span>
      <button
        v-for="tz in availableTimezones"
        :key="tz.id"
        type="button"
        class="loc-astro-tz-chip interactive-el"
        @click="selectTimezonePreset(tz.code || tz.id)"
      >
        {{ formatTimezoneChipLabel(tz) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLocationAstronomyWidget } from './useLocationAstronomyWidget';
import type {
  LocationAstronomyWidgetProps,
  LocationAstronomyWidgetEmits,
} from './LocationAstronomyWidget.model';

const props = defineProps<LocationAstronomyWidgetProps>();
const emit = defineEmits<LocationAstronomyWidgetEmits>();

const {
  previewWorldHour,
  maxHoursPerDay,
  availableTimezones,
  availableSeasons,
  resolvedGeo,
  timeInfo,
  scaleLabel,
  formattedOffset,
  coordinatesLabel,
  selectTimezonePreset,
  setSeasonDayPreset,
  formatTimezoneChipLabel,
} = useLocationAstronomyWidget(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/EntityEditor.css"></style>

