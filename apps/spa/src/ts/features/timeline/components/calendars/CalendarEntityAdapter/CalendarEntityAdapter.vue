<template>
  <div class="calendar-entity-adapter flex gap-4 w-full">
    <!-- Сайдбар дерева планет и календарей -->
    <aside class="calendar-adapter-sidebar w-64 flex-shrink-0">
      <PlanetCalendarTree
        :planets="planetsList"
        :calendars="calendarsList"
        :selected-id="selectedNodeId"
        @select-planet="onSelectPlanet"
        @select-calendar="onSelectCalendar"
        @add-planet="onAddPlanet"
        @add-calendar="onAddCalendar"
      />
    </aside>

    <!-- Основная рабочая область: Планета vs Календарь -->
    <main class="calendar-adapter-workspace flex-1 min-w-0">
      <PlanetEditor
        v-if="activeMode === 'planet'"
        :planet-id="selectedPlanetId"
        :project-id="props.projectId"
        :is-read-only="props.isPreview"
        @save="onPlanetSave"
      />
      <CalendarEditor
        v-else
        :calendar-id="selectedCalendarId"
        :project-id="props.projectId"
        :is-read-only="props.isPreview"
        @update:calendar="onCalendarUpdate"
        @save="onCalendarSave"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import CalendarEditor from '../CalendarEditor/CalendarEditor.vue';
import PlanetEditor from '@/features/timeline/components/planets/PlanetEditor/PlanetEditor.vue';
import PlanetCalendarTree from '@/features/timeline/components/calendars/PlanetCalendarTree/PlanetCalendarTree.vue';
import type {
  CalendarEntityAdapterProps,
  CalendarEntityAdapterEmits,
} from './CalendarEntityAdapter.model';
import { useCalendarEntityAdapter } from './useCalendarEntityAdapter';

const props = defineProps<CalendarEntityAdapterProps>();
const emit = defineEmits<CalendarEntityAdapterEmits>();

const {
  activeMode,
  selectedPlanetId,
  selectedCalendarId,
  selectedNodeId,
  planetsList,
  calendarsList,
  onSelectPlanet,
  onSelectCalendar,
  onAddPlanet,
  onAddCalendar,
  onCalendarUpdate,
  onCalendarSave,
  onPlanetSave,
} = useCalendarEntityAdapter(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarEntityAdapter.css"></style>
