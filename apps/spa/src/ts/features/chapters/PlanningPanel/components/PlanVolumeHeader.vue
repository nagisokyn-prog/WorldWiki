<template>
  <div class="plan-volume-header">
    <!-- Clickable Header with Collapse Toggle & Progress -->
    <div
      class="volume-header-row"
      title="Нажмите, чтобы скрыть или развернуть главы тома"
      @click="handleToggle"
    >
      <div class="volume-header-left">
        <span class="volume-collapse-icon">
          {{ isCollapsed ? '▸' : '▼' }}
        </span>
        <span class="volume-header-icon">📚</span>
        <div class="volume-select-container">
          <button
            v-if="volumes && volumes.length > 1"
            type="button"
            class="volume-header-title-btn"
            title="Переключить том"
            @click.stop="toggleVolumeMenu"
          >
            <span class="volume-header-title-text">{{ title }}</span>
            <span class="volume-header-chevron">▾</span>
          </button>
          <span v-else class="volume-header-title" :title="title">
            {{ title }}
          </span>

          <!-- Volume Switcher Dropdown (optional if volumes passed) -->
          <div
            v-if="isVolumeMenuOpen"
            class="volume-select-dropdown"
            @click.stop
          >
            <div class="volume-select-header">Тома проекта:</div>
            <button
              v-for="vol in volumes"
              :key="vol.id"
              type="button"
              class="volume-select-item"
              :class="{ 'is-selected': vol.id === currentVolumeId || (title === vol.title) }"
              @click="selectVolume(vol.id)"
            >
              <span class="truncate">📚 {{ vol.title || 'Новый том' }}</span>
              <span v-if="vol.id === currentVolumeId || (title === vol.title)" class="volume-select-check">✓</span>
            </button>
          </div>
        </div>
      </div>
      <div class="volume-header-right">
        <div class="volume-header-pct">
          {{ progressPct }}%
        </div>
      </div>
    </div>

    <!-- Continuous Progress Bar -->
    <div class="volume-progress-bar">
      <div
        class="volume-progress-fill"
        :style="{ width: progressPct + '%' }"
      ></div>
    </div>

    <!-- Status Badges -->
    <div class="volume-status-chips">
      <span v-if="stats.inProgress > 0" class="chip-status chip-warning" title="Задач в работе">
        <span class="status-dot warning"></span> {{ stats.inProgress }} в работе
      </span>
      <span v-if="stats.done > 0" class="chip-status chip-success" title="Завершенных задач">
        <span class="status-dot success"></span> {{ stats.done }} готово
      </span>
      <span v-if="stats.planned > 0" class="chip-status chip-neutral" title="Задач в планах">
        <span class="status-dot neutral"></span> {{ stats.planned }} в планах
      </span>
      <span v-if="stats.blocked > 0" class="chip-status chip-blocked" title="Заблокированных задач">
        <span class="status-dot blocked"></span> {{ stats.blocked }} ждёт
      </span>
      <span v-if="stats.total === 0" class="chip-status-empty">
        Нет задач
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanVolumeHeaderProps, PlanVolumeHeaderEmits } from './PlanVolumeHeader.model';
import { usePlanVolumeHeader } from './usePlanVolumeHeader';

const props = withDefaults(defineProps<PlanVolumeHeaderProps>(), {
  isCollapsed: false,
});
const emit = defineEmits<PlanVolumeHeaderEmits>();

const {
  isVolumeMenuOpen,
  progressPct,
  handleToggle,
  toggleVolumeMenu,
  selectVolume
} = usePlanVolumeHeader(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
