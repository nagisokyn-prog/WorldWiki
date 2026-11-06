<template>
  <div class="tab3-culture-lore">
    <!-- СЕКЦИЯ 1: ВРЕМЕНА ГОДА (СЕЗОНЫ) -->
    <Tab3SeasonsSection
      :seasons="seasons"
      :months="months"
      :is-read-only="isReadOnly"
      @add-season="addSeason"
      @update-seasons="updateSeasons"
      @remove-season="removeSeason"
    />

    <!-- СЕКЦИЯ 2: ПРАЗДНИКИ И ПАМЯТНЫЕ ДАТЫ -->
    <Tab3HolidaysSection
      :holidays="holidays"
      :months="months"
      :is-read-only="isReadOnly"
      @add-holiday="addHoliday"
      @update-holidays="updateHolidays"
      @remove-holiday="removeHoliday"
    />

    <!-- СЕКЦИЯ 3: ЛУННЫЕ ФАЗЫ В КУЛЬТУРЕ -->
    <Tab3MoonPhasesSection
      :phase-names="phaseNames"
      :is-read-only="isReadOnly"
      @update-phase-names="updatePhaseNames"
      @find-double-full-moon="findDoubleFullMoon"
    />

    <!-- СЕКЦИИ 4 & 5: ВОЗРАСТ ПЕРСОНАЖЕЙ И ГЕОГРАФИЯ/ЧАСОВОЙ ПОЯС -->
    <Tab3AgeTimezoneSection
      :age-rule="ageRule"
      :calendar-timezone="calendarTimezone"
      :regions-list="regionsList"
      :timezones-list="timezonesList"
      :selected-regions="selectedRegions"
      :is-read-only="isReadOnly"
      @update-age-rule="updateAgeRule"
      @set-calendar-timezone="setCalendarTimezone"
      @toggle-region="toggleRegion"
      @add-region="addRegion"
    />
  </div>
</template>

<script setup lang="ts">
import type { Tab3CultureLoreProps, Tab3CultureLoreEmits } from './Tab3CultureLore.model';
import { useTab3CultureLore } from './useTab3CultureLore';
import Tab3SeasonsSection from './components/Tab3SeasonsSection/Tab3SeasonsSection.vue';
import Tab3HolidaysSection from './components/Tab3HolidaysSection/Tab3HolidaysSection.vue';
import Tab3MoonPhasesSection from './components/Tab3MoonPhasesSection/Tab3MoonPhasesSection.vue';
import Tab3AgeTimezoneSection from './components/Tab3AgeTimezoneSection/Tab3AgeTimezoneSection.vue';

const props = defineProps<Tab3CultureLoreProps>();
const emit = defineEmits<Tab3CultureLoreEmits>();

const {
  months,
  seasons,
  holidays,
  phaseNames,
  ageRule,
  regionsList,
  timezonesList,
  selectedRegions,
  calendarTimezone,
  updateSeasons,
  addSeason,
  removeSeason,
  updateHolidays,
  addHoliday,
  removeHoliday,
  updatePhaseNames,
  findDoubleFullMoon,
  updateAgeRule,
  toggleRegion,
  addRegion,
  setCalendarTimezone,
} = useTab3CultureLore(props, emit);
</script>
