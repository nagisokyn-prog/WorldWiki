<template>
  <Teleport to="body">
    <div v-if="isOpen" class="time-atlas-overlay" @click.self="$emit('close')">
      <div class="time-atlas-modal">
        <!-- Шапка модалки -->
        <div class="atlas-header">
          <div class="header-left">
            <div class="atlas-badge"><i class="fas fa-compass"></i> Атлас Времени</div>
            <h2 class="atlas-title">Наложение и синхронизация летоисчислений</h2>
          </div>
          <div class="header-actions">
            <div class="atlas-tabs">
              <button
                class="atlas-tab-btn"
                :class="{ active: activeTab === 'converter' }"
                @click="activeTab = 'converter'"
              >
                <i class="fas fa-exchange-alt"></i> Мост Времени
              </button>
              <button
                class="atlas-tab-btn"
                :class="{ active: activeTab === 'matrix' }"
                @click="activeTab = 'matrix'"
              >
                <i class="fas fa-th"></i> Наложенная Сетка
              </button>
              <button
                class="atlas-tab-btn"
                :class="{ active: activeTab === 'world_time' }"
                @click="activeTab = 'world_time'"
              >
                <i class="fas fa-globe-americas"></i> Срез Мира
              </button>
              <button
                class="atlas-tab-btn"
                :class="{ active: activeTab === 'snippets' }"
                @click="activeTab = 'snippets'"
              >
                <i class="fas fa-feather-alt"></i> Датировки в Текст
              </button>
            </div>
            <button class="atlas-close-btn interactive-el" title="Закрыть" @click="$emit('close')">×</button>
          </div>
        </div>

        <!-- Контент модалки -->
        <div class="atlas-body custom-scrollbar">
          <!-- Детектор совпадений / Сообщение дня -->
          <div v-if="activeAlignments.length > 0" class="alignment-banner">
            <div class="alignment-icon">✨</div>
            <div class="alignment-content">
              <div class="alignment-title">Культурные и астрономические маркеры этого момента:</div>
              <div class="alignment-tags">
                <span
                  v-for="(align, aIdx) in activeAlignments"
                  :key="aIdx"
                  class="alignment-tag"
                  :class="align.type"
                >
                  <strong>{{ align.calName }}:</strong> {{ align.text }}
                </span>
              </div>
            </div>
          </div>

          <!-- ВКЛАДКА 1: Мост Времени -->
          <TimeAtlasBridgeTab
            v-if="activeTab === 'converter'"
            :master-calendar-record="masterCalendarRecord"
            :local-calendar-records="localCalendarRecords"
            :get-local-date-for-cal="getLocalDateForCal"
            :update-from-local-date="updateFromLocalDate"
            :get-date-meta="getDateMeta"
          />

          <!-- ВКЛАДКА 2: Наложенная Сетка -->
          <TimeAtlasMatrixTab
            v-if="activeTab === 'matrix'"
            v-model:matrix-base-cal-id="matrixBaseCalId"
            v-model:matrix-compare-cal-id="matrixCompareCalId"
            v-model:matrix-era="matrixEra"
            v-model:matrix-year="matrixYear"
            v-model:matrix-month="matrixMonth"
            :all-calendars="allCalendars"
            :matrix-base-cal="matrixBaseCal"
            :matrix-grid-days="matrixGridDays"
            @select-day="selectMatrixDay"
            @prev-month="prevMatrixMonth"
            @next-month="nextMatrixMonth"
          />

          <!-- ВКЛАДКА 3: Срез Мира и География -->
          <TimeAtlasWorldTab
            v-if="activeTab === 'world_time'"
            v-model:world-hour="worldHour"
            v-model:world-minute="worldMinute"
            :master-calendar-name="masterCalendarName"
            :max-hours="maxHours"
            :max-minutes="maxMinutes"
            :world-time-snapshot="worldTimeSnapshot"
            :world-time-snippet="worldTimeSnippet"
            :is-world-time-copied="isWorldTimeCopied"
            :copy-world-time-snippet="copyWorldTimeSnippet"
          />

          <!-- ВКЛАДКА 4: Датировки для Рукописи -->
          <TimeAtlasSnippetsTab
            v-if="activeTab === 'snippets'"
            :snippet-formats="snippetFormats"
            :copied-idx="copiedIdx"
            :copy-snippet="copySnippet"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { TimeAtlasModalProps, TimeAtlasModalEmits } from './TimeAtlasModal.model';
import { useTimeAtlasModal } from './useTimeAtlasModal';
import TimeAtlasBridgeTab from './tabs/TimeAtlasBridgeTab.vue';
import TimeAtlasMatrixTab from './tabs/TimeAtlasMatrixTab.vue';
import TimeAtlasWorldTab from './tabs/TimeAtlasWorldTab.vue';
import TimeAtlasSnippetsTab from './tabs/TimeAtlasSnippetsTab.vue';

const props = defineProps<TimeAtlasModalProps>();

defineEmits<TimeAtlasModalEmits>();

const {
  activeTab,
  allCalendars,
  masterCalendarRecord,
  masterCalendarName,
  maxHours,
  maxMinutes,
  localCalendarRecords,
  worldTimeSnapshot,
  worldTimeSnippet,
  worldHour,
  worldMinute,
  isWorldTimeCopied,
  copyWorldTimeSnippet,
  matrixBaseCalId,
  matrixCompareCalId,
  matrixEra,
  matrixYear,
  matrixMonth,
  matrixBaseCal,
  matrixGridDays,
  activeAlignments,
  snippetFormats,
  copiedIdx,
  getLocalDateForCal,
  updateFromLocalDate,
  getDateMeta,
  selectMatrixDay,
  prevMatrixMonth,
  nextMatrixMonth,
  copySnippet
} = useTimeAtlasModal(props);
</script>

<style src="@worldwiki/resources/styles/features/timeline/TimeAtlasModal.css"></style>
