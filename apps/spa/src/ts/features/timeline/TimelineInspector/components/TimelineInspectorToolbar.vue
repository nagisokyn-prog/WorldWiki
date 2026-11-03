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
        <select v-model="filters.selectedVolumeId" class="inspector-select" title="Фильтр по томам">
          <option v-for="v in volumeOptions" :key="v.id" :value="v.id">📚 {{ v.title }}</option>
        </select>
      </div>

      <!-- Режим связей стрелками -->
      <div class="inspector-control-group">
        <span class="control-label">Связи:</span>
        <select v-model="filters.linkMode" class="inspector-select">
          <option value="focus">🎯 Фокус (при наведении / клике)</option>
          <option value="all">🕸️ Все связи (паутина)</option>
          <option value="none">🚫 Без связей</option>
        </select>
      </div>

      <!-- Изоляция сцен главы -->
      <div class="inspector-control-group">
        <span class="control-label">Сцены:</span>
        <select v-model="filters.isolatedChapterId" class="inspector-select">
          <option :value="null">Все сцены рукописи</option>
          <option
            v-for="ch in filteredChapters"
            :key="'iso-' + ch.id"
            :value="ch.id"
          >
            {{ ch.title }} ({{ ch.sceneCount || 0 }} сцен)
          </option>
        </select>
      </div>

      <!-- Переключатель режима горизонтов читателя -->
      <div class="inspector-control-group">
        <span class="control-label">Горизонт:</span>
        <select
          v-model="filters.readerHorizonChapterOrder"
          class="inspector-select"
        >
          <option :value="null">👑 Режим Автора (Все главы)</option>
          <option
            v-for="ch in filteredChapters"
            :key="'opt-' + ch.id"
            :value="ch.sort_order"
          >
            📖 До: {{ ch.title }}
          </option>
        </select>
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
import type { TimelineInspectorToolbarProps, TimelineInspectorToolbarEmits } from './TimelineInspectorToolbar.model';
import { useTimelineInspectorToolbar } from './useTimelineInspectorToolbar';

const props = defineProps<TimelineInspectorToolbarProps>();
const emit = defineEmits<TimelineInspectorToolbarEmits>();

const { onRefresh } = useTimelineInspectorToolbar(props, emit);
</script>

