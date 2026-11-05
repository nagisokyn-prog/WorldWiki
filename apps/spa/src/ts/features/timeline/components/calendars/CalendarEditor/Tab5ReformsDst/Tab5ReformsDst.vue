<template>
  <div class="tab5-reforms-dst">
    <!-- СЕКЦИЯ 1: ИСТОРИЧЕСКИЕ РЕФОРМЫ И СМЕНА СТИЛЕЙ -->
    <Tab5ReformsSection
      :mode="mode"
      :mode-badge-text="modeBadgeText"
      :active-preset="activePreset"
      :presets="reformPresets"
      :month-names="monthNames"
      :gap-params="gapParams"
      :trans-params="transParams"
      :reset-params="resetParams"
      :new-style-first-day-str="newStyleFirstDayStr"
      :visual-tape-start="visualTape.start"
      :visual-tape-middle="visualTape.middle"
      :visual-tape-end="visualTape.end"
      :dual-dating-input="dualDatingInput"
      :dual-dating-result="dualDatingResult"
      :is-read-only="isReadOnly"
      @select-preset="selectReformPreset"
      @update-mode="mode = $event"
      @update-gap="Object.assign(gapParams, $event)"
      @update-trans="Object.assign(transParams, $event)"
      @update-reset="Object.assign(resetParams, $event)"
      @update-dual-input="Object.assign(dualDatingInput, $event)"
    />

    <!-- СЕКЦИЯ 2: ЛЕТНЕЕ ВРЕМЯ (DST) И ЧАСОВЫЕ ПОЯСА -->
    <Tab5DstSection
      :policy-config="policyConfig"
      :policy-badge-text="policyBadgeText"
      :shift-badge-text="shiftBadgeText"
      :shift-select-val="shiftSelectVal"
      :active-preset="dstActivePreset"
      :presets="dstPresets"
      :month-names="monthNames"
      :weekday-names="weekdayNames"
      :sim-tab="simTab"
      :spring-slider-val="springSliderVal"
      :autumn-slider-val="autumnSliderVal"
      :autumn-fold="autumnFold"
      :spring-time-str="springTimeStr"
      :autumn-time-str="autumnTimeStr"
      :spring-alert-title="springAlertTitle"
      :spring-alert-desc="springAlertDesc"
      :spring-alert-style="springAlertStyle"
      :spring-alert-text-color="springAlertTextColor"
      :autumn-alert-desc="autumnAlertDesc"
      :autumn-alert-style="autumnAlertStyle"
      :is-read-only="isReadOnly"
      @select-preset="selectDstPreset"
      @update-policy-type="policyConfig.policy = $event; syncToCalendar()"
      @update-shift-select="updateShiftSelect"
      @update-shift-minutes="policyConfig.shiftMinutes = $event; syncToCalendar()"
      @update-spring-rule="Object.assign(policyConfig.springRule, $event); syncToCalendar()"
      @update-autumn-rule="Object.assign(policyConfig.autumnRule, $event); syncToCalendar()"
      @switch-sim-tab="simTab = $event"
      @update-spring-slider="springSliderVal = $event"
      @update-autumn-slider="autumnSliderVal = $event"
      @update-autumn-fold="autumnFold = $event"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  DstPresetKey,
  ReformPresetKey,
  Tab5ReformsDstEmits,
  Tab5ReformsDstProps,
} from './Tab5ReformsDst.model';
import Tab5ReformsSection from './components/Tab5ReformsSection.vue';
import Tab5DstSection from './components/Tab5DstSection.vue';
import { useTab5ReformsDst } from './useTab5ReformsDst';

const props = defineProps<Tab5ReformsDstProps>();
const emit = defineEmits<Tab5ReformsDstEmits>();

const {
  mode,
  activePreset,
  gapParams,
  transParams,
  resetParams,
  dualDatingInput,
  policyConfig,
  shiftSelectVal,
  dstActivePreset,
  simTab,
  springSliderVal,
  autumnSliderVal,
  autumnFold,
  monthNames,
  weekdayNames,
  modeBadgeText,
  newStyleFirstDayStr,
  visualTape,
  dualDatingResult,
  policyBadgeText,
  shiftBadgeText,
  springTimeStr,
  autumnTimeStr,
  springAlertTitle,
  springAlertDesc,
  springAlertStyle,
  springAlertTextColor,
  autumnAlertDesc,
  autumnAlertStyle,
  selectReformPreset,
  selectDstPreset,
  updateShiftSelect,
  syncToCalendar,
} = useTab5ReformsDst(props, emit);

const reformPresets: Array<{ key: ReformPresetKey; label: string }> = [
  { key: 'gregorian_1582', label: '🌍 Григорианская реформа 1582 г. (-10 дней: 4 окт → 15 окт)' },
  { key: 'caesar_46bc', label: '🏛️ Реформа Цезаря 46 г. до н.э. (+90 дней, «Год замешательства»)' },
  { key: 'russia_1918', label: '🇷🇺 Декрет СНК 1918 г. (-13 дней: 31 янв → 14 фев)' },
  { key: 'french_1792', label: '⚜️ Французская республика 1792 г. (Сброс в Год 1)' },
  { key: 'fantasy_magic', label: '🏰 Фэнтези: Смена Династии (Затмение Солнца, -7 дней)' },
];

const dstPresets: Array<{ key: DstPresetKey; label: string }> = [
  { key: 'eu_standard', label: '🇪🇺 Европейский стандарт (Посл. вс марта → Посл. вс окт)' },
  { key: 'us_standard', label: '🇺🇸 Американский стандарт (2-е вс марта → 1-е вс ноября)' },
  { key: 'fixed_dates', label: '📅 Фиксированные даты (25 Марта → 25 Октября)' },
  { key: 'fantasy_harvest', label: '🌾 Фэнтези: Время Жатвы (+120 мин летом на 3 месяца)' },
  { key: 'none', label: '🚫 Без перевода часов (DST отключен)' },
];
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab5ReformsDst.css"></style>
