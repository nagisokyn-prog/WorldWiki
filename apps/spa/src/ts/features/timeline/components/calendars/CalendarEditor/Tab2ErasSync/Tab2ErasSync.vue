<template>
  <div class="tab2-eras-sync">
    <!-- СЕКЦИЯ 1: ПРИВЯЗКА ЛЕТОИСЧИСЛЕНИЯ (СИНХРОНИЗАЦИЯ С МИРОМ) -->
    <Tab2SyncSection
      :is-master="isMaster"
      :sync-type="syncType"
      :selected-event-id="selectedEventId"
      :anchor-events="anchorEvents"
      :current-event="currentEvent"
      :offset-direction="offsetDirection"
      :offset-years="offsetYears"
      :target-calendar-id="targetCalendarId"
      :target-calendar-year="targetCalendarYear"
      :selected-master-era-index="selectedMasterEraIndex"
      :master-eras="masterEras"
      :master-months="masterMonths"
      :anchor-month="anchorMonth"
      :anchor-day="anchorDay"
      :sync-description="syncDescription"
      :is-read-only="isReadOnly"
      @update-sync-type="setSyncType"
      @add-new-event="addAnchorEvent({ name: 'Новая веха', year: 1, month: 0, day: 1 })"
      @update-selected-event="selectedEventId = $event"
      @update-offset-direction="offsetDirection = $event"
      @update-offset-years="offsetYears = $event"
      @save-current-event="saveCurrentEvent"
      @update-target-calendar="targetCalendarId = $event"
      @update-target-calendar-year="targetCalendarYear = $event"
      @update-master-era="selectedMasterEraIndex = $event"
      @update-anchor-month="anchorMonth = $event"
      @update-anchor-day="anchorDay = $event"
    />

    <!-- СЕКЦИЯ 2: ЭПОХИ И ЭРЫ КАЛЕНДАРЯ -->
    <Tab2ErasSection
      :eras="eras"
      :months="masterMonths"
      :is-read-only="isReadOnly"
      @add-era="addEra"
      @update-eras="updateEras"
      @remove-era="removeEra"
      @reorder-era="reorderEra"
    />

    <!-- СЕКЦИЯ 3: ОПОРНЫЕ ИСТОРИЧЕСКИЕ ВЕХИ -->
    <Tab2AnchorEventsSection
      :anchor-events="anchorEvents"
      :is-read-only="isReadOnly"
      @add-anchor-event="addAnchorEvent"
      @update-anchor-event="updateAnchorEvent"
      @remove-anchor-event="removeAnchorEvent"
    />
  </div>
</template>

<script setup lang="ts">
import type { Tab2ErasSyncProps, Tab2ErasSyncEmits } from './Tab2ErasSync.model';
import { useTab2ErasSync } from './useTab2ErasSync';
import Tab2SyncSection from './components/Tab2SyncSection/Tab2SyncSection.vue';
import Tab2ErasSection from './components/Tab2ErasSection/Tab2ErasSection.vue';
import Tab2AnchorEventsSection from './components/Tab2AnchorEventsSection/Tab2AnchorEventsSection.vue';

const props = defineProps<Tab2ErasSyncProps>();
const emit = defineEmits<Tab2ErasSyncEmits>();

const {
  isMaster,
  syncType,
  selectedEventId,
  offsetDirection,
  offsetYears,
  targetCalendarId,
  targetCalendarYear,
  selectedMasterEraIndex,
  anchorMonth,
  anchorDay,
  eras,
  masterEras,
  masterMonths,
  anchorEvents,
  currentEvent,
  syncDescription,
  setSyncType,
  updateEras,
  addEra,
  removeEra,
  reorderEra,
  addAnchorEvent,
  removeAnchorEvent,
  saveCurrentEvent,
  updateAnchorEvent,
} = useTab2ErasSync(props, emit);
</script>
