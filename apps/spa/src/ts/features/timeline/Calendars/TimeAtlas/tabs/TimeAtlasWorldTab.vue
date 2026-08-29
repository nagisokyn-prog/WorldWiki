<template>
  <div class="tab-pane">
    <div class="world-time-intro">
      <p>Синхронный срез физического времени и астрономического солнца по всем регионам планеты в этот момент:</p>
    </div>

    <!-- Сетка регионов мира -->
    <div class="world-regions-grid">
      <div
        v-for="item in worldTimeSnapshot"
        :key="item.region.id"
        class="region-card glass-panel"
      >
        <div class="region-card-header">
          <div class="region-info">
            <span class="region-name">{{ item.region.name }}</span>
            <span class="region-tz-badge">
              {{ item.timezone?.name || 'Пояс' }} ({{ item.offsetHours >= 0 ? '+' : '' }}{{ item.offsetHours }} ч)
            </span>
          </div>
          <span class="phase-pill" :class="item.sunStatus.phase">
            {{ item.sunStatus.phase_label }}
          </span>
        </div>

        <div class="region-time-display">
          <span class="time-value">{{ item.localTimeStr }}</span>
          <span class="date-value">{{ item.localDateFormatted }}</span>
        </div>

        <div class="region-card-footer">
          <div class="sun-detail-row">
            <span>☀️ Восход: <strong>{{ item.sunStatus.sunrise_time }}</strong></span>
            <span>Закат: <strong>{{ item.sunStatus.sunset_time }}</strong></span>
          </div>
          <div class="sun-detail-row text-muted">
            <span>Свет: {{ item.sunStatus.daylight_text }}</span>
            <span>{{ item.sunStatus.note }}</span>
          </div>
        </div>
      </div>

      <div v-if="worldTimeSnapshot.length === 0" class="empty-world-panel glass-panel">
        <i class="fas fa-compass fa-2x mb-2 text-muted"></i>
        <p>В мире ещё не настроены регионы и часовые пояса.</p>
        <p class="text-sm text-muted">Перейдите в настройки Календаря Мира, чтобы добавить города, пояса, широту и долготу.</p>
      </div>
    </div>

    <!-- Художественная лор-панорама -->
    <div class="world-panorama-card glass-panel mt-4">
      <div class="panorama-header">
        <span class="panorama-title"><i class="fas fa-feather-alt"></i> Литературная панорама для рукописи:</span>
        <button
          class="copy-btn interactive-el"
          :class="{ copied: isWorldTimeCopied }"
          @click="copyWorldTimeSnippet"
        >
          <i :class="isWorldTimeCopied ? 'fas fa-check' : 'fas fa-copy'"></i>
          {{ isWorldTimeCopied ? 'Скопировано!' : 'Скопировать сводку' }}
        </button>
      </div>
      <div class="panorama-quote">«{{ worldTimeSnippet }}»</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorldRegion, WorldTimezone, RegionSunStatus } from '../../../../../services/Calendars/calendar.types';

defineProps<{
  worldTimeSnapshot: Array<{
    region: WorldRegion;
    timezone?: WorldTimezone;
    offsetHours: number;
    localTimeStr: string;
    localDateFormatted: string;
    sunStatus: RegionSunStatus;
  }>;
  worldTimeSnippet: string;
  isWorldTimeCopied: boolean;
  copyWorldTimeSnippet: () => Promise<void>;
}>();
</script>
