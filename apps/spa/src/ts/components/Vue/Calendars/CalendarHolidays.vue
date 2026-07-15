<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
      <h4 style="margin: 0;">🎉 Праздники</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="item-list">
        <div v-for="(holiday, hIdx) in modelValue.праздники" :key="hIdx" class="item-row" style="display: flex; gap: 12px; align-items: center; width: 100%;">
          <input
            type="text"
            v-model="holiday.название"
            class="item-name interactive-el"
            placeholder="Название праздника"
            style="flex: 1;"
          />
          <div style="display: flex; gap: 12px; align-items: center; flex: 2;">
            <XboxWheel
              :horizontal="wheelHorizontal"
              :options="
                (modelValue.месяцы || []).map((m: any, mi: number) => ({
                  value: mi,
                  label: m.название,
                }))
              "
              v-model.number="holiday.дата_начала.месяц"
              style="flex: 1; min-width: 0;"
            >
            </XboxWheel>
              <input
              type="number"
              v-model.number="holiday.дата_начала.день"
              min="1"
              :max="
                getDaysInMonth(
                  modelValue,
                  modelValue.точка_отсчета?.год || 0,
                  holiday.дата_начала.месяц,
                )
              "
              style="width: 60px"
              class="interactive-el"
            />
            <span v-if="holiday.дата_конца">—</span>
            <XboxWheel
              v-if="holiday.дата_конца"
              :horizontal="wheelHorizontal"
              :options="
                (modelValue.месяцы || []).map((m: any, mi: number) => ({
                  value: mi,
                  label: m.название,
                }))
              "
              v-model.number="holiday.дата_конца.месяц"
              style="flex: 1; min-width: 0;"
            >
            </XboxWheel>
            <input
              v-if="holiday.дата_конца"
              type="number"
              v-model.number="holiday.дата_конца.день"
              min="1"
              :max="
                getDaysInMonth(
                  modelValue,
                  modelValue.точка_отсчета?.год || 0,
                  holiday.дата_конца.месяц,
                )
              "
              style="width: 60px"
              class="interactive-el"
            />
          </div>
          <div class="item-actions">
            <button
              class="btn-icon interactive-el"
              @click.prevent="moveItem(Number(hIdx), -1)"
              :disabled="Number(hIdx) === 0"
            >
              ↑
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="moveItem(Number(hIdx), 1)"
              :disabled="Number(hIdx) === (modelValue.праздники?.length || 0) - 1"
            >
              ↓
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="modelValue.праздники?.splice(Number(hIdx), 1)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addHoliday">➕ Добавить праздник</button>
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
});

const moveItem = (idx: number, delta: number) => {
  const arr = props.modelValue.праздники;
  if (!arr) return;
  const n = idx + delta;
  if (n >= 0 && n < arr.length) {
    [arr[idx], arr[n]] = [arr[n], arr[idx]];
  }
};

const addHoliday = () => {
  if (!props.modelValue.праздники) props.modelValue.праздники = [];
  props.modelValue.праздники.push({
    название: `Праздник ${props.modelValue.праздники.length + 1}`,
    дата_начала: { месяц: 0, день: 1 },
    дата_конца: { месяц: 0, день: 1 },
  });
};
</script>
