<template>
  <div class="calendar-section sync-anchor-section">
    <div class="section-header sync-header" @click="isCollapsed = !isCollapsed">
      <div class="header-left-title">
        <h4 class="m-0"><i class="fas fa-link"></i> Привязка летоисчисления</h4>
        <span
          class="help-icon"
          title="Связывает начало летоисчисления этого календаря с другим поселением или с опорным событием мира."
        >[?]</span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="mt-3">
      <!-- 1. Переключатель типа привязки -->
      <div class="sync-target-type-row mb-3 flex gap-4 flex-wrap">
        <label class="flex items-center gap-1 cursor-pointer text-xs">
          <input
            v-model="syncTargetType"
            type="radio"
            value="event"
            class="interactive-el"
            @change="updateMasterYearFromState"
          />
          <span>🌟 К опорному событию</span>
        </label>

        <label v-if="otherCalendars.length > 0" class="flex items-center gap-1 cursor-pointer text-xs">
          <input
            v-model="syncTargetType"
            type="radio"
            value="calendar"
            class="interactive-el"
            @change="updateMasterYearFromState"
          />
          <span>📜 К календарю другого поселения</span>
        </label>

        <label class="flex items-center gap-1 cursor-pointer text-xs">
          <input
            v-model="syncTargetType"
            type="radio"
            value="master_era"
            class="interactive-el"
            @change="updateMasterYearFromState"
          />
          <span>🌍 К Календарю Мира / Эпохе</span>
        </label>
      </div>

      <!-- Вариант 1: К опорному событию -->
      <div v-if="syncTargetType === 'event'" class="mb-3">
        <div class="sync-grid-container mb-2">
          <div class="calendar-field">
            <div class="flex items-center justify-between gap-1 mb-1">
              <label class="glass-label sync-field-label m-0">Опорное историческое событие</label>
              <button
                type="button"
                class="btn-calc-daylight interactive-el text-xs"
                style="padding: 2px 6px;"
                title="Создать новое опорное историческое событие в Календаре Мира"
                @click.prevent="quickAddMasterEvent"
              >
                ➕ Новое событие
              </button>
            </div>
            <select
              v-if="masterEvents.length > 0"
              v-model="selectedEventId"
              class="interactive-el glass-select w-full"
              @change="updateMasterYearFromState"
            >
              <option v-for="evt in masterEvents" :key="evt.id" :value="evt.id">
                🌟 {{ evt.name }} ({{ evt.year }} г. Мира)
              </option>
            </select>
            <div v-else class="text-xs text-muted py-1 flex items-center justify-between gap-2">
              <span>В Календаре Мира пока нет событий.</span>
              <button
                type="button"
                class="btn-calc-daylight interactive-el text-xs"
                @click.prevent="quickAddMasterEvent"
              >
                ➕ Создать веху
              </button>
            </div>
          </div>

          <div class="calendar-field">
            <label class="glass-label sync-field-label">Направление</label>
            <div class="sync-direction-toggle">
              <label class="flex items-center gap-1 cursor-pointer">
                <input
                  v-model="syncDirection"
                  type="radio"
                  value="after"
                  class="interactive-el"
                  @change="updateMasterYearFromState"
                />
                <span>После события</span>
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input
                  v-model="syncDirection"
                  type="radio"
                  value="before"
                  class="interactive-el"
                  @change="updateMasterYearFromState"
                />
                <span>До события</span>
              </label>
            </div>
          </div>

          <div class="calendar-field">
            <label class="glass-label sync-field-label">Смещение (лет)</label>
            <input
              v-model.number="offsetYears"
              type="number"
              min="0"
              class="interactive-el glass-input sync-year-input w-full"
              placeholder="0"
              @input="updateMasterYearFromState"
            />
          </div>
        </div>

        <!-- Быстрое редактирование выбранной вехи прямо здесь -->
        <div v-if="selectedMasterEvent" class="sync-advanced-box flex gap-2 items-center flex-wrap mt-2">
          <span class="text-xs text-muted font-semibold">Веха:</span>
          <input
            v-model="selectedMasterEvent.name"
            type="text"
            class="interactive-el glass-input flex-1 text-xs"
            placeholder="Название (например: Рождество Христово)"
            @input="updateMasterYearFromState"
          />
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted">Год:</span>
            <input
              v-model.number="selectedMasterEvent.year"
              type="number"
              class="interactive-el glass-input text-xs"
              style="width: 80px;"
              @input="updateMasterYearFromState"
            />
          </div>
        </div>
      </div>

      <!-- Вариант 2: К календарю другого поселения -->
      <div v-else-if="syncTargetType === 'calendar'" class="sync-grid-container mb-3">
        <div class="calendar-field">
          <label class="glass-label sync-field-label">Календарь другого поселения / культуры</label>
          <select
            v-model="selectedCalendarId"
            class="interactive-el glass-select w-full"
            @change="updateMasterYearFromState"
          >
            <option v-for="c in otherCalendars" :key="c._id || c.название" :value="c._id || c.название">
              📜 {{ c.название }}
            </option>
          </select>
        </div>

        <div class="calendar-field">
          <label class="glass-label sync-field-label">Когда там шёл год</label>
          <input
            v-model.number="targetCalendarYear"
            type="number"
            min="1"
            class="interactive-el glass-input sync-year-input w-full"
            placeholder="1"
            @input="updateMasterYearFromState"
          />
        </div>
      </div>

      <!-- Вариант 3: К Календарю Мира / Эпохе -->
      <div v-else class="sync-grid-container mb-3">
        <div class="calendar-field">
          <label class="glass-label sync-field-label">Опорная эпоха в Календаре Мира</label>
          <select
            v-model.number="selectedMasterEraIndex"
            class="interactive-el glass-select w-full"
            @change="updateMasterYearFromState"
          >
            <option :value="-1">🌍 От начала Календаря Мира (Год 1)</option>
            <option v-for="(era, idx) in masterEras" :key="idx" :value="idx">
              🏛️ {{ era.название }} (с {{ era.год_начала }} г.)
            </option>
          </select>
        </div>

        <div class="calendar-field">
          <label class="glass-label sync-field-label">Направление отсчёта</label>
          <div class="sync-direction-toggle">
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                v-model="syncDirection"
                type="radio"
                value="after"
                class="interactive-el"
                @change="updateMasterYearFromState"
              />
              <span>После начала эпохи</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                v-model="syncDirection"
                type="radio"
                value="before"
                class="interactive-el"
                @change="updateMasterYearFromState"
              />
              <span>До начала эпохи</span>
            </label>
          </div>
        </div>

        <div class="calendar-field">
          <label class="glass-label sync-field-label">Смещение (лет)</label>
          <input
            v-model.number="offsetYears"
            type="number"
            min="0"
            class="interactive-el glass-input sync-year-input w-full"
            placeholder="0"
            @input="updateMasterYearFromState"
          />
        </div>
      </div>

      <!-- Конкретный день и месяц в Календаре Мира -->
      <div class="sync-date-row mb-3">
        <div class="calendar-field">
          <label class="glass-label sync-field-label">Месяц в Календаре Мира</label>
          <select v-model.number="masterAnchorDate.month" class="interactive-el glass-select w-full">
            <option v-for="(m, idx) in masterMonths" :key="idx" :value="idx">
              {{ m.название }}
            </option>
          </select>
        </div>
        <div class="calendar-field">
          <label class="glass-label sync-field-label">День в Календаре Мира</label>
          <input
            v-model.number="masterAnchorDate.day"
            type="number"
            min="1"
            :max="masterMaxDays"
            class="interactive-el glass-input w-full"
          />
        </div>
      </div>

      <!-- Карточка статуса сопряжения -->
      <div class="sync-status-card">
        <i class="fas fa-check-circle sync-status-icon"></i>
        <div class="sync-status-body">
          <span class="sync-status-title">Синхронизировано</span>
          <span class="sync-status-desc">{{ offsetDescription }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarSyncAnchor } from './useCalendarSyncAnchor';
import type { CalendarSyncAnchorProps } from './CalendarSyncAnchor.model';

const props = defineProps<CalendarSyncAnchorProps>();

const {
  isCollapsed,
  syncTargetType,
  selectedEventId,
  selectedCalendarId,
  targetCalendarYear,
  masterEvents,
  selectedMasterEvent,
  quickAddMasterEvent,
  otherCalendars,
  masterEras,
  masterMonths,
  masterAnchorDate,
  masterMaxDays,
  selectedMasterEraIndex,
  syncDirection,
  offsetYears,
  updateMasterYearFromState,
  offsetDescription,
} = useCalendarSyncAnchor(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarSyncAnchor.css"></style>
