<template>
  <div class="atlas-tab-pane tab-pane">
    <div class="world-time-intro flex justify-between items-center flex-wrap gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <p class="m-0">Синхронный срез физического времени и солнца по локациям и поясам:</p>
        <div class="atlas-tabs">
          <button
            type="button"
            class="atlas-tab-btn interactive-el"
            :class="{ active: (worldSliceFilter || 'all') === 'all' }"
            @click="$emit('update:worldSliceFilter', 'all')"
          >
            🌐 Все пояса
          </button>
          <button
            type="button"
            class="atlas-tab-btn interactive-el"
            :class="{ active: worldSliceFilter === 'settlements' }"
            @click="$emit('update:worldSliceFilter', 'settlements')"
          >
            🏙️ Локации книги
          </button>
          <button
            type="button"
            class="atlas-tab-btn interactive-el"
            :class="{ active: worldSliceFilter === 'capitals' }"
            @click="$emit('update:worldSliceFilter', 'capitals')"
          >
            👑 Столицы государств
          </button>
        </div>
      </div>

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

    <!-- Сетка регионов и локаций мира -->
    <div class="world-regions-grid">
      <div
        v-for="item in worldTimeSnapshot"
        :key="item.region.id"
        class="region-card glass-panel"
      >
        <div class="region-card-header">
          <div class="region-info">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="region-name">{{ item.region.name }}</span>
              <span v-if="item.isStateCapital" class="region-tz-badge">
                👑 Столица{{ item.stateName ? ` (${item.stateName})` : '' }}
              </span>
              <span v-else-if="item.stateName" class="region-tz-badge">
                🏛️ {{ item.stateName }}
              </span>
            </div>
            <span class="region-tz-badge">
              {{ item.timezone?.name || 'Пояс' }} ({{ item.offsetHours >= 0 ? '+' : '' }}{{ item.offsetHours }} ч)
              <template v-if="item.isInherited && item.inheritedFromName">
                · 🔗 от {{ item.inheritedFromName }}
              </template>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="item.entityId && openLocationEntity"
              type="button"
              class="copy-btn interactive-el text-xs"
              title="Открыть карточку локации в Энциклопедии"
              @click="openLocationEntity(item.entityId)"
            >
              📖
            </button>
            <span class="phase-pill" :class="item.sunStatus.phase">
              {{ item.sunStatus.phase_label }}
            </span>
          </div>
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
        <p>По выбранному фильтру не найдено локаций или часовых поясов.</p>
        <p class="text-sm text-muted">
          Задайте координаты или часовой пояс в карточках локаций/государств либо в настройках Календаря Мира.
        </p>
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

defineProps<TimeAtlasWorldTabProps>();

defineEmits<TimeAtlasWorldTabEmits>();
</script>
