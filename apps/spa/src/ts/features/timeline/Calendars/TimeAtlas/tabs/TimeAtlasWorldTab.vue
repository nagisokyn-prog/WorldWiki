<template>
  <div class="atlas-tab-pane tab-pane">
    <div class="world-time-intro flex justify-between items-center flex-wrap gap-3">
      <p class="m-0">Синхронный срез физического времени и астрономического солнца по всем регионам планеты в этот момент:</p>
      
      <div class="world-time-controls flex items-center gap-2 glass-panel p-2">
        <label class="text-xs text-muted">Время: {{ masterCalendarName || 'Календарь Мира' }}:</label>
        <input
          :value="worldHour"
          type="number"
          min="0"
          :max="(maxHours || 24) - 1"
          class="interactive-el glass-input w-16 text-center"
          title="Час"
          @input="$emit('update:worldHour', Number(($event.target as HTMLInputElement).value))"
        />
        <span>:</span>
        <input
          :value="worldMinute"
          type="number"
          min="0"
          :max="(maxMinutes || 60) - 1"
          class="interactive-el glass-input w-16 text-center"
          title="Минута"
          @input="$emit('update:worldMinute', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
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
import type { TimeAtlasWorldTabProps, TimeAtlasWorldTabEmits } from './TimeAtlasWorldTab.model';
import type { WorldRegion, WorldTimezone, RegionSunStatus } from '../../../../../services/Calendars/calendar.types';

defineProps<TimeAtlasWorldTabProps>>();

defineEmits<TimeAtlasWorldTabEmits>>();
</script>
