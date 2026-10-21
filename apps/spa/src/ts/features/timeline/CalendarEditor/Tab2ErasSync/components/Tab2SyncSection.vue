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
      <div
        v-if="syncType === 'event'"
        style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;"
      >
        <div class="grid-3" style="align-items: end;">
          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label class="form-label" style="margin: 0;">Опорное событие</label>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-ghost-sm"
                style="padding: 1px 6px; font-size: 10px;"
                @click="$emit('add-new-event')"
              >
                ➕ Новое событие
              </button>
            </div>
            <select
              class="form-select"
              :value="selectedEventId"
              :disabled="isReadOnly"
              @change="$emit('update-selected-event', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="ev in anchorEvents" :key="ev.id || ev.name" :value="ev.id || ev.name">
                {{ ev.name }} (Год {{ ev.year }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Направление</label>
            <div style="display: flex; gap: 12px; padding-top: 6px;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                <input
                  type="radio"
                  name="sync-dir-event"
                  value="after"
                  :checked="offsetDirection === 'after'"
                  :disabled="isReadOnly"
                  @change="$emit('update-offset-direction', 'after')"
                />
                <span>После события</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                <input
                  type="radio"
                  name="sync-dir-event"
                  value="before"
                  :checked="offsetDirection === 'before'"
                  :disabled="isReadOnly"
                  @change="$emit('update-offset-direction', 'before')"
                />
                <span>До события</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Смещение (лет)</label>
            <input
              type="number"
              class="form-input"
              :value="offsetYears"
              min="0"
              :disabled="isReadOnly"
              @input="$emit('update-offset-years', parseInt(($event.target as HTMLInputElement).value) || 0)"
            />
          </div>
        </div>

        <!-- Быстрое редактирование выбранной вехи прямо здесь -->
        <div
          v-if="currentEvent"
          style="display: flex; gap: 8px; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-subtle);"
        >
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Веха:</span>
          <input
            :value="currentEvent.name"
            type="text"
            class="form-input"
            style="flex: 1; padding: 4px 8px; font-size: 12px;"
            :disabled="isReadOnly"
            @input="$emit('save-current-event', { ...currentEvent, name: ($event.target as HTMLInputElement).value })"
          />
          <span style="font-size: 11px; color: var(--text-muted);">Год в Календаре Мира:</span>
          <input
            :value="currentEvent.year"
            type="number"
            class="form-input"
            style="width: 80px; padding: 4px 8px; font-size: 12px;"
            :disabled="isReadOnly"
            @input="$emit('save-current-event', { ...currentEvent, year: +($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>

      <!-- Вариант 2: К календарю другого поселения -->
      <div
        v-if="syncType === 'calendar'"
        style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;"
      >
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Календарь другого поселения / культуры</label>
            <select
              class="form-select"
              :value="targetCalendarId"
              :disabled="isReadOnly"
              @change="$emit('update-target-calendar', ($event.target as HTMLSelectElement).value)"
            >
              <option value="julian">Юлианский календарь (Церковный)</option>
              <option value="padishah">Имперский Стандарт Падишаха</option>
              <option value="fremen">Цикл Сиетча Табр (Фременский)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Когда там шёл год</label>
            <input
              type="number"
              class="form-input"
              :value="targetCalendarYear"
              min="1"
              :disabled="isReadOnly"
              @input="$emit('update-target-calendar-year', parseInt(($event.target as HTMLInputElement).value) || 1)"
            />
          </div>
        </div>
      </div>

      <!-- Вариант 3: К Календарю Мира / Эпохе -->
      <div
        v-if="syncType === 'master_era'"
        style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;"
      >
        <div class="grid-3">
          <div class="form-group">
            <label class="form-label">Опорная эпоха в Календаре Мира</label>
            <select
              class="form-select"
              :value="selectedMasterEraIndex"
              :disabled="isReadOnly"
              @change="$emit('update-master-era', parseInt(($event.target as HTMLSelectElement).value) || 0)"
            >
              <option :value="-1">🌍 От начала Календаря Мира (Год 1)</option>
              <option v-for="(era, idx) in masterEras" :key="idx" :value="idx">
                🏛️ {{ era.название }} (с {{ era.год_начала }} г.)
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Направление отсчёта</label>
            <div style="display: flex; gap: 12px; padding-top: 6px;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                <input
                  type="radio"
                  name="sync-dir-era"
                  value="after"
                  :checked="offsetDirection === 'after'"
                  :disabled="isReadOnly"
                  @change="$emit('update-offset-direction', 'after')"
                />
                <span>После начала</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                <input
                  type="radio"
                  name="sync-dir-era"
                  value="before"
                  :checked="offsetDirection === 'before'"
                  :disabled="isReadOnly"
                  @change="$emit('update-offset-direction', 'before')"
                />
                <span>До начала</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Смещение (лет)</label>
            <input
              type="number"
              class="form-input"
              :value="offsetYears"
              min="0"
              :disabled="isReadOnly"
              @input="$emit('update-offset-years', parseInt(($event.target as HTMLInputElement).value) || 0)"
            />
          </div>
        </div>
      </div>

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
      <div class="drift-banner" style="background: rgba(56, 189, 248, 0.08); border-color: var(--border-accent); color: var(--text-main);">
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
import { ref } from 'vue';
import type { CalendarEra, CalendarMonth } from '@/services/Calendars/calendar.types';
import type { AnchorEventDto, SyncDirection, SyncTargetType } from '../Tab2ErasSync.model';

defineProps<{
  isMaster: boolean;
  syncType: SyncTargetType;
  selectedEventId: string;
  anchorEvents: AnchorEventDto[];
  currentEvent: AnchorEventDto | undefined;
  offsetDirection: SyncDirection;
  offsetYears: number;
  targetCalendarId: string;
  targetCalendarYear: number;
  selectedMasterEraIndex: number;
  masterEras: CalendarEra[];
  masterMonths: CalendarMonth[];
  anchorMonth: number;
  anchorDay: number;
  syncDescription: string;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'update-sync-type', type: SyncTargetType): void;
  (e: 'add-new-event'): void;
  (e: 'update-selected-event', id: string): void;
  (e: 'update-offset-direction', dir: SyncDirection): void;
  (e: 'update-offset-years', years: number): void;
  (e: 'save-current-event', event: AnchorEventDto): void;
  (e: 'update-target-calendar', calId: string): void;
  (e: 'update-target-calendar-year', year: number): void;
  (e: 'update-master-era', eraIdx: number): void;
  (e: 'update-anchor-month', monthIdx: number): void;
  (e: 'update-anchor-day', day: number): void;
}>();

const isCollapsed = ref(false);
</script>
