<template>
  <div class="tool-section timeline-section">
    <div v-if="!project" class="calendar-warning-box">
      ⚠️ Пожалуйста, введите название произведения выше, чтобы создавать календари.
    </div>

    <div v-else class="calendars-panel-layout">
      <!-- Сайдбар-дерево: Планета -> Календари -->
      <PlanetCalendarTree
        :planets="planets"
        :calendars="calendars"
        :selected-id="selectedId"
        @select-planet="selectPlanet"
        @select-calendar="selectCalendar"
        @add-calendar="addCalendar"
        @add-planet="addPlanet"
      />

      <!-- Область редактирования -->
      <div class="calendars-main-content mt-3">
        <!-- Редактор Астрофизики Планеты -->
        <PlanetEditor
          v-if="selectedPlanet"
          :key="`planet-${selectedPlanet.id}`"
          :planet="selectedPlanet"
          :calendars="calendars"
          :master-calendar="masterCalendar"
          @save="savePlanet"
          @delete="deletePlanet"
        />

        <!-- Конструктор выбранного календаря культуры -->
        <div
          v-else-if="selectedCalendarIdx !== null && calendars[selectedCalendarIdx]"
          :key="calendars[selectedCalendarIdx].id || `cal-${selectedCalendarIdx}`"
          class="calendar-editor-card"
        >
          <div class="calendar-header-bar flex justify-between items-center mb-3">
            <div class="flex items-center gap-2">
              <span class="text-lg">📄</span>
              <input
                v-model="calendars[selectedCalendarIdx].data.название"
                type="text"
                class="interactive-el calendar-title-input"
                placeholder="Название календаря"
              />
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                class="btn-icon interactive-el"
                title="Диагностический аудит календаря"
                @click.prevent="openAudit(calendars[selectedCalendarIdx].data)"
              >
                🔍
              </button>
              <button
                type="button"
                class="btn-icon interactive-el"
                title="Сохранить календарь"
                @click.prevent="saveCalendar(selectedCalendarIdx)"
              >
                💾
              </button>
              <button
                type="button"
                class="delete-btn interactive-el"
                title="Удалить календарь"
                @click.prevent="removeCalendar(selectedCalendarIdx)"
              >
                🗑️
              </button>
            </div>
          </div>

          <!-- Карточки календаря культуры -->
          <div class="calendar-top-row-grid">
            <DialHierarchyConstructor v-model="calendars[selectedCalendarIdx].data" />
            <CalendarWeekdays v-model="calendars[selectedCalendarIdx].data" />
            <CalendarMonths v-model="calendars[selectedCalendarIdx].data" />
            <CalendarCorrection v-model="calendars[selectedCalendarIdx].data" />
            <CalendarEras v-model="calendars[selectedCalendarIdx].data" />
            <CharacterAgeSettings v-model="calendars[selectedCalendarIdx].data" />
          </div>

          <div class="calendar-middle-row-grid">
            <CalendarSeasons v-model="calendars[selectedCalendarIdx].data" />
          </div>

          <div v-if="!calendars[selectedCalendarIdx].is_master" class="calendar-full-row-grid">
            <CalendarSyncAnchor
              v-model="calendars[selectedCalendarIdx].data"
              :master-calendar="masterCalendar"
              :available-calendars="calendars.map(c => c.data)"
            />
          </div>

          <div class="calendar-full-row-grid">
            <CalendarAnchorEvents v-model="calendars[selectedCalendarIdx].data" />
          </div>

          <div class="calendar-full-row-grid">
            <CalendarGeography
              v-model="calendars[selectedCalendarIdx].data"
              :planet="selectedCalendarPlanet"
            />
          </div>

          <div class="calendar-full-row-grid">
            <CalendarHolidays v-model="calendars[selectedCalendarIdx].data" />
          </div>

          <CalendarPlayground
            :calendar="calendars[selectedCalendarIdx].data"
            @set-origin="setStoryOrigin(selectedCalendarIdx)"
          />
        </div>

        <div v-else class="calendar-empty-box">
          Выберите планету или календарь в дереве выше.
        </div>
      </div>

      <CalendarAuditModal
        v-if="selectedAuditCalendar"
        v-model="isAuditOpen"
        :calendar="selectedAuditCalendar"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import PlanetCalendarTree from "../Calendars/PlanetCalendarTree/PlanetCalendarTree.vue";
import PlanetEditor from "../Calendars/PlanetEditor/PlanetEditor.vue";
import DialHierarchyConstructor from "../Calendars/DialHierarchyConstructor/DialHierarchyConstructor.vue";
import CalendarWeekdays from "../Calendars/CalendarWeekdays/CalendarWeekdays.vue";
import CalendarMonths from "../Calendars/CalendarMonths/CalendarMonths.vue";
import CalendarCorrection from "../Calendars/CalendarCorrection/CalendarCorrection.vue";
import CalendarEras from "../Calendars/CalendarEras/CalendarEras.vue";
import CharacterAgeSettings from "../Calendars/CharacterAgeSettings/CharacterAgeSettings.vue";
import CalendarSeasons from "../Calendars/CalendarSeasons/CalendarSeasons.vue";
import CalendarHolidays from "../Calendars/CalendarHolidays/CalendarHolidays.vue";
import CalendarGeography from "../Calendars/CalendarGeography/CalendarGeography.vue";
import CalendarAnchorEvents from "../Calendars/CalendarAnchorEvents/CalendarAnchorEvents.vue";
import CalendarPlayground from "../Calendars/CalendarPlayground/CalendarPlayground.vue";
import CalendarSyncAnchor from "../Calendars/CalendarSyncAnchor/CalendarSyncAnchor.vue";
import CalendarAuditModal from "../Calendars/CalendarAuditModal/CalendarAuditModal.vue";
import { useCalendarsPanel } from './useCalendarsPanel';

const props = defineProps<{ project?: string }>();

const {
  project,
  calendars,
  planets,
  selectedPlanet,
  selectedCalendarIdx,
  selectedCalendarPlanet,
  selectedId,
  selectPlanet,
  selectCalendar,
  addPlanet,
  savePlanet,
  deletePlanet,
  masterCalendar,
  addCalendar,
  saveCalendar,
  removeCalendar,
  setStoryOrigin,
  saveAll,
  isAuditOpen,
  selectedAuditCalendar,
  openAudit,
} = useCalendarsPanel(props);

defineExpose({ saveAll });
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarsPanel.css"></style>
