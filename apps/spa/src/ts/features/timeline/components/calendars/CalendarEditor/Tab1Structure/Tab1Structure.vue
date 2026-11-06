<template>
  <div class="tab1-structure">
    <!-- СЕКЦИЯ 1: ЦИФЕРБЛАТ И СУТКИ -->
    <Tab1DialSection
      :dial-units="dialUnits"
      :day-start-offset="dayStartOffset"
      :is-read-only="isReadOnly"
      @apply-preset="applyDialPreset"
      @set-day-start-offset="setDayStartOffset"
    />

    <!-- СЕКЦИЯ 2: ДНИ НЕДЕЛИ -->
    <Tab1WeekdaysSection
      :weekdays="weekdays"
      :new-weekday-name="newWeekdayName"
      :pause-on-holidays="pauseOnHolidays"
      :is-read-only="isReadOnly"
      @apply-week-preset="applyWeekPreset"
      @reorder-weekday="reorderWeekday"
      @remove-weekday="removeWeekday"
      @update:new-weekday-name="newWeekdayName = $event"
      @add-new-day="addNewDay"
      @set-pause-on-holidays="setPauseOnHolidays"
    />

    <!-- СЕКЦИЯ 3: МЕСЯЦЫ ГОДА -->
    <Tab1MonthsSection
      :months="months"
      :seasons="seasons"
      :total-year-days="totalYearDays"
      :first-month-of-year="firstMonthOfYear"
      :new-year-day="newYearDay"
      :is-read-only="isReadOnly"
      @balance-months="balanceMonthsEvenly"
      @add-month="addMonth"
      @update-months="updateMonths"
      @set-first-month="setFirstMonthOfYear"
      @set-new-year-day="setNewYearDay"
    />

    <!-- СЕКЦИЯ 4: КАЛЕНДАРНАЯ КОРРЕКЦИЯ И ПРАЗДНИКИ (WASM ENGINE) -->
    <Tab1LeapSection
      :active-system-preset="leap.activeSystemPreset.value"
      :rule-type="leap.ruleType.value"
      :orbit-days="leap.orbitDays.value"
      :drift-label="leap.driftLabel.value"
      :drift-is-ok="leap.driftIsOk.value"
      :show-warning-banner="leap.showWarningBanner.value"
      :total-nominal-days="leap.totalNominalDays.value"
      :months-days-sum="leap.monthsDaysSum.value"
      :extra-days-count="leap.extraDaysCount.value"
      :extra-days-name="leap.extraDaysName.value"
      :placement="leap.placement.value"
      :after-month-index="leap.afterMonthIndex.value"
      :pause-weekdays="leap.pauseWeekdays.value"
      :months="months"
      :year-tape="leap.yearTape.value"
      :leap-offset="leap.leapOffset.value"
      :target-mode="leap.targetMode.value"
      :target-month-index="leap.targetMonthIndex.value"
      :target-month-preview="leap.targetMonthPreview.value"
      :harmonics="leap.harmonics.value"
      :upcoming-years="leap.upcomingYears.value"
      :suggestions="leap.suggestions.value"
      :is-read-only="isReadOnly"
      @select-system-preset="leap.selectSystemPreset"
      @select-rule-type="leap.selectRuleType"
      @apply-suggestion="leap.applySuggestion"
      @balance-months-extra="leap.balanceMonthsForExtraDays"
      @reset-extra-days="leap.resetExtraDays"
      @update-extra-days="leap.updateExtraDays"
      @update-extra-name="leap.updateExtraName"
      @update-placement="leap.updatePlacement"
      @update-after-month="leap.updateAfterMonth"
      @update-pause-weekdays="leap.updatePauseWeekdays"
      @update-leap-offset="leap.updateLeapOffset"
      @update-target-mode="leap.updateTargetMode"
      @update-target-month="leap.updateTargetMonth"
      @update-harmonic-period="leap.updateHarmonicPeriod"
      @remove-harmonic="leap.removeHarmonic"
      @add-harmonic="leap.addHarmonic"
    />
  </div>
</template>

<script setup lang="ts">
import type { Tab1StructureProps, Tab1StructureEmits } from './Tab1Structure.model';
import { useTab1Structure } from './useTab1Structure';
import Tab1DialSection from './components/Tab1DialSection/Tab1DialSection.vue';
import Tab1WeekdaysSection from './components/Tab1WeekdaysSection/Tab1WeekdaysSection.vue';
import Tab1MonthsSection from './components/Tab1MonthsSection/Tab1MonthsSection.vue';
import Tab1LeapSection from './components/Tab1LeapSection/Tab1LeapSection.vue';

const props = defineProps<Tab1StructureProps>();
const emit = defineEmits<Tab1StructureEmits>();

const {
  months,
  seasons,
  weekdays,
  pauseOnHolidays,
  dialUnits,
  dayStartOffset,
  totalYearDays,
  firstMonthOfYear,
  newYearDay,
  setFirstMonthOfYear,
  setNewYearDay,
  newWeekdayName,
  applyDialPreset,
  setDayStartOffset,
  applyWeekPreset,
  reorderWeekday,
  removeWeekday,
  setPauseOnHolidays,
  updateMonths,
  addMonth,
  balanceMonthsEvenly,
  addNewDay,
  leap,
} = useTab1Structure(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab1Structure.css"></style>
