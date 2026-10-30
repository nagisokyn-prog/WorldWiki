<template>
  <div class="section-card sync-anchor-section">
    <div class="section-header sync-header" style="cursor: pointer;" @click="isCollapsed = !isCollapsed">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="section-title">🔗 Привязка летоисчисления (Синхронизация с миром)</div>
        <span
          class="help-icon"
          style="font-size: 11px; color: var(--text-muted); cursor: help;"
          title="Связывает точку отсчета этого календаря с общемировой осью времени или с опорным историческим событием."
        >
          [?]
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span v-if="isMaster" class="status-chip warning">🌟 Мастер-календарь мира</span>
        <span v-else class="status-chip success">🌟 Синхронизировано</span>
        <span class="correction-collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
      </div>
    </div>

    <div v-show="!isCollapsed" style="margin-top: 10px;">
      <!-- Переключатель типа привязки (3 радиокнопки) -->
      <div class="sync-target-type-row" style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">
          <input
            type="radio"
            name="sync-target-type"
            value="event"
            :checked="syncType === 'event'"
            :disabled="isReadOnly"
            @change="$emit('update-sync-type', 'event')"
          />
          <span>🌟 К опорному историческому событию</span>
        </label>

        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">
          <input
            type="radio"
            name="sync-target-type"
            value="calendar"
            :checked="syncType === 'calendar'"
            :disabled="isReadOnly"
            @change="$emit('update-sync-type', 'calendar')"
          />
          <span>📜 К календарю другого поселения / культуры</span>
        </label>

        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">
          <input
            type="radio"
            name="sync-target-type"
            value="master_era"
            :checked="syncType === 'master_era'"
            :disabled="isReadOnly"
            @change="$emit('update-sync-type', 'master_era')"
          />
          <span>🌍 К Календарю Мира / Эпохе</span>
        </label>
      </div>

      <!-- Вариант 1: К опорному событию -->
      <Tab2SyncEventForm
        v-if="syncType === 'event'"
        :selected-event-id="selectedEventId"
        :anchor-events="anchorEvents"
        :current-event="currentEvent"
        :offset-direction="offsetDirection"
        :offset-years="offsetYears"
        :is-read-only="isReadOnly"
        @add-new-event="$emit('add-new-event')"
        @update-selected-event="$emit('update-selected-event', $event)"
        @update-offset-direction="$emit('update-offset-direction', $event)"
        @update-offset-years="$emit('update-offset-years', $event)"
        @save-current-event="$emit('save-current-event', $event)"
      />

      <!-- Вариант 2: К календарю другого поселения -->
      <Tab2SyncCalendarForm
        v-if="syncType === 'calendar'"
        :target-calendar-id="targetCalendarId"
        :target-calendar-year="targetCalendarYear"
        :is-read-only="isReadOnly"
        @update-target-calendar="$emit('update-target-calendar', $event)"
        @update-target-calendar-year="$emit('update-target-calendar-year', $event)"
      />

      <!-- Вариант 3: К Календарю Мира / Эпохе -->
      <Tab2SyncEraForm
        v-if="syncType === 'master_era'"
        :selected-master-era-index="selectedMasterEraIndex"
        :master-eras="masterEras"
        :offset-direction="offsetDirection"
        :offset-years="offsetYears"
        :is-read-only="isReadOnly"
        @update-master-era="$emit('update-master-era', $event)"
        @update-offset-direction="$emit('update-offset-direction', $event)"
        @update-offset-years="$emit('update-offset-years', $event)"
      />

      <!-- Конкретный день и месяц привязки в Календаре Мира -->
      <div class="grid-2" style="margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label">Месяц в Календаре Мира</label>
          <select
            class="form-select"
            :value="anchorMonth"
            :disabled="isReadOnly"
            @change="$emit('update-anchor-month', parseInt(($event.target as HTMLSelectElement).value) || 0)"
          >
            <option v-for="(m, idx) in masterMonths" :key="idx" :value="idx">
              {{ m.название || `Месяц ${idx + 1}` }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">День в Календаре Мира</label>
          <input
            type="number"
            class="form-input"
            :value="anchorDay"
            min="1"
            max="31"
            :disabled="isReadOnly"
            @input="$emit('update-anchor-day', parseInt(($event.target as HTMLInputElement).value) || 1)"
          />
        </div>
      </div>

      <!-- Карточка статуса сопряжения -->
      <div class="drift-banner" style="background: var(--info-bg); border-color: var(--border-accent); color: var(--text-main);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">✓</span>
          <div>
            <div style="font-weight: 600; font-size: 13px; color: var(--accent-primary);">
              Статус синхронизации: {{ isMaster ? 'Мастер-календарь' : 'Активна' }}
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              {{ syncDescription }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab2SyncSectionProps, Tab2SyncSectionEmits } from './Tab2SyncSection.model';
import type { CalendarEra, CalendarMonth } from '@/services/Calendars/calendar.types';
import type { AnchorEventDto, SyncDirection, SyncTargetType } from '../Tab2ErasSync.model';
import Tab2SyncEventForm from './Tab2SyncEventForm.vue';
import Tab2SyncCalendarForm from './Tab2SyncCalendarForm.vue';
import Tab2SyncEraForm from './Tab2SyncEraForm.vue';
import { useTab2SyncSection } from './useTab2SyncSection';

defineProps<Tab2SyncSectionProps>();

defineEmits<Tab2SyncSectionEmits>();

const { isCollapsed } = useTab2SyncSection();
</script>
