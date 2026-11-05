<template>
  <div class="loc-astro-widget glass-card">
    <div class="loc-astro-header">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-bold text-main">🧭 География и пояс</span>
        <span class="loc-astro-crumb">{{ scaleLabel }}</span>
        <span v-if="resolvedGeo.isStateCapital" class="loc-astro-crumb is-current">
          👑 Столица ({{ resolvedGeo.stateName || 'Государство' }})
        </span>
        <span class="loc-astro-crumb font-medium text-accent">
          {{ formattedOffset }}
        </span>
        <span v-if="coordinatesLabel" class="text-xs text-muted">
          ({{ coordinatesLabel }})
        </span>
      </div>

      <div class="text-xs text-muted">
        <span v-if="resolvedGeo.isInherited">
          🔗 Унаследовано от: <strong class="text-accent">{{ resolvedGeo.inheritedFromName }}</strong>
        </span>
        <span v-else-if="resolvedGeo.hasExplicitGeography">
          📍 Собственный часовой пояс и координаты
        </span>
        <span v-else>
          🌐 Часовой пояс по умолчанию
        </span>
      </div>
    </div>

    <!-- Иерархическая цепочка предков -->
    <div v-if="resolvedGeo.breadcrumbs.length > 1" class="loc-astro-breadcrumbs">
      <span class="text-xs font-medium">Иерархия:</span>
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
  </div>
</template>

<script setup lang="ts">
import { useLocationAstronomyWidget } from './useLocationAstronomyWidget';
import type {
  LocationAstronomyWidgetProps,
  LocationAstronomyWidgetEmits,
} from './LocationAstronomyWidget.model';

const props = defineProps<LocationAstronomyWidgetProps>();
defineEmits<LocationAstronomyWidgetEmits>();

const {
  resolvedGeo,
  scaleLabel,
  formattedOffset,
  coordinatesLabel,
} = useLocationAstronomyWidget(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/EntityEditor.css"></style>

