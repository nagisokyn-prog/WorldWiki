<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">🎯 Точка отсчёта</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div v-if="modelValue.точка_отсчета" class="grid-3">
        <div class="calendar-field">
          <label>Год</label>
          <input v-model.number="modelValue.точка_отсчета.год" type="number" class="interactive-el" />
        </div>
        <div class="calendar-field">
          <label>Месяц</label>
          <XboxWheel
            v-model.number="modelValue.точка_отсчета.месяц"
            :horizontal="wheelHorizontal"
            :options="
              (modelValue.месяцы || []).map((m: any, idx: number) => ({
                value: idx,
                label: m.название,
              }))
            "
          >
          </XboxWheel>
        </div>
        <div class="calendar-field">
          <label>День</label>
          <input
            v-model.number="modelValue.точка_отсчета.день"
            type="number"
            min="1"
            :max="
              getDaysInMonth(modelValue, modelValue.точка_отсчета.год, modelValue.точка_отсчета.месяц)
            "
            class="interactive-el"
          />
        </div>
      </div>
      <div v-if="modelValue.точка_отсчета" class="calendar-field">
        <label>День недели</label>
        <XboxWheel
          v-model.number="modelValue.точка_отсчета.день_недели"
          :horizontal="wheelHorizontal"
          :options="
            (modelValue.названия_дней_недели || []).map((day: string, idx: number) => ({
              value: idx,
              label: day,
            }))
          "
        >
        </XboxWheel>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";


const isCollapsed = ref(false);
import { XboxWheel, settingsService } from '@worldwiki/components';
import { CalendarMath } from "../../../services/Calendars/calendar.math";

const getDaysInMonth = (cal: any, year: number, monthIdx: number) => CalendarMath.getDaysInMonth(cal, year, monthIdx);

import type { CalendarData } from "../../../services/Calendars/calendar.types";

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
    props.modelValue.точка_отсчета = { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 };
  }
});
</script>
