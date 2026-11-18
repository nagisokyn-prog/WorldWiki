<template>
  <div class="inspector-toolbar">
    <div class="inspector-toolbar-title">
      <h2 class="inspector-title">
        <span class="inspector-icon">⏳</span> Хронологический Инспектор
      </h2>
      <span v-if="filteredEventsCount" class="inspector-badge">
        {{ filteredEventsCount }} событий / {{ filteredChaptersCount }} глав
      </span>
    </div>

    <div class="inspector-toolbar-controls">
      <!-- Фильтр по томам -->
      <div v-if="volumeOptions && volumeOptions.length > 1" class="inspector-control-group">
        <span class="control-label">Том:</span>
        <XboxWheel v-model="filters.selectedVolumeId" :options="volumeWheelOptions" class="inspector-select" title="Фильтр по томам" />
      </div>

      <!-- Режим связей стрелками -->
      <div class="inspector-control-group">
        <span class="control-label">Связи:</span>
        <XboxWheel v-model="filters.linkMode" :options="linkModeOptions" class="inspector-select" />
      </div>

      <!-- Изоляция сцен главы -->
      <div class="inspector-control-group">
        <span class="control-label">Сцены:</span>
        <XboxWheel
          :model-value="filters.isolatedChapterId ?? ''"
          :options="isolatedChapterOptions"
          class="inspector-select"
          @update:model-value="filters.isolatedChapterId = $event || null"
        />
      </div>

      <!-- Переключатель режима горизонтов читателя -->
      <div class="inspector-control-group">
        <span class="control-label">Горизонт:</span>
        <XboxWheel
          :model-value="filters.readerHorizonChapterOrder ?? ''"
          :options="horizonOptions"
          class="inspector-select"
          @update:model-value="filters.readerHorizonChapterOrder = $event === '' ? null : Number($event)"
        />
      </div>

      <label class="inspector-checkbox-label">
        <input v-model="filters.showFlashbacksOnly" type="checkbox" class="inspector-checkbox" />
        <span>Только ретроспективы (Flashbacks)</span>
      </label>

      <button
        class="btn-refresh"
        :disabled="isLoading"
        @click="onRefresh"
      >
        🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { TimelineInspectorToolbarProps, TimelineInspectorToolbarEmits } from './TimelineInspectorToolbar.model';
import { useTimelineInspectorToolbar } from './useTimelineInspectorToolbar';

const props = defineProps<TimelineInspectorToolbarProps>();
const emit = defineEmits<TimelineInspectorToolbarEmits>();

const {
  volumeWheelOptions,
  linkModeOptions,
  isolatedChapterOptions,
  horizonOptions,
  onRefresh,
} = useTimelineInspectorToolbar(props, emit);
</script>

