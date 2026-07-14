<template>
  <div class="calendar-section interactive-el">
    <h4>🎯 Точка отсчёта</h4>
    <div class="grid-3" v-if="modelValue.точка_отсчета">
      <div class="calendar-field">
        <label>Год</label>
        <input type="number" v-model.number="modelValue.точка_отсчета.год" class="interactive-el" />
      </div>
      <div class="calendar-field">
        <label>Месяц</label>
        <XboxWheel
          :horizontal="wheelHorizontal"
          :options="
            (modelValue.месяцы || []).map((m: any, idx: number) => ({
              value: idx,
              label: m.название,
            }))
          "
          v-model.number="modelValue.точка_отсчета.месяц"
        >
        </XboxWheel>
      </div>
      <div class="calendar-field">
        <label>День</label>
        <input
          type="number"
          v-model.number="modelValue.точка_отсчета.день"
          min="1"
          :max="
            getDaysInMonth(modelValue, modelValue.точка_отсчета.год, modelValue.точка_отсчета.месяц)
          "
          class="interactive-el"
        />
      </div>
    </div>
    <div class="calendar-field" v-if="modelValue.точка_отсчета">
      <label>День недели</label>
      <XboxWheel
        :horizontal="wheelHorizontal"
        :options="
          (modelValue.названия_дней_недели || []).map((day: string, idx: number) => ({
            value: idx,
            label: day,
          }))
        "
        v-model.number="modelValue.точка_отсчета.день_недели"
      >
      </XboxWheel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import XboxWheel from "../../../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue";
import { settingsService } from "../../../../../tauri-surreal-kit/frontend/src/js/services/settings.service";
import { calendarService } from "../../../services/calendar.service";

const getDaysInMonth = (cal: any, year: number, monthIdx: number) => calendarService.getDaysInMonth(cal, year, monthIdx);

import { CalendarData } from "../../../services/Calendars/calendar.types";

const props = defineProps<{
  modelValue: CalendarData;
}>();

const wheelHorizontal = ref(
  settingsService.getSettings()?.dropdowns?.wheelOrientation === "horizontal",
);

onMounted(() => {
  settingsService.onChange(
    (s) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === "horizontal"),
  );
  if (!props.modelValue.точка_отсчета) {
    props.modelValue.точка_отсчета = { год: 1, месяц: 0, день: 1, день_недели: 0 };
  }
});
</script>
