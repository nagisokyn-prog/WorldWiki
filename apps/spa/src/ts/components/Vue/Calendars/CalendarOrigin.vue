<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
      <h4 style="margin: 0;">🎯 Точка отсчёта</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";


const isCollapsed = ref(false);
import { XboxWheel, settingsService } from '@worldwiki/components';
import { CalendarMath } from "../../../services/Calendars/calendar.math";

const getDaysInMonth = (cal: any, year: number, monthIdx: number) => CalendarMath.getDaysInMonth(cal, year, monthIdx);

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
    props.modelValue.точка_отсчета = { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 };
  }
});
</script>
