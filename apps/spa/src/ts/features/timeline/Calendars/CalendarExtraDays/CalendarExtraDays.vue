<template>
  <div class="calendar-section extra-days-card">
    <div class="section-header extra-days-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <h4 class="m-0">✨ Дни вне месяцев (Праздники)</h4>
        <span v-if="baseDays > 0" class="badge-count">+{{ baseDays }} дн.</span>
      </div>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="mt-3">
      <div class="grid-2 gap-3 mb-3">
        <div class="calendar-field">
          <label class="glass-label">Базовых дней вне месяцев</label>
          <input v-model.number="baseDays" type="number" min="0" class="interactive-el" />
        </div>
        <div class="calendar-field">
          <label class="glass-label">Високосная надбавка</label>
          <input v-model.number="leapDays" type="number" min="0" class="interactive-el" />
        </div>
      </div>

      <div class="calendar-field mb-3">
        <label class="glass-label">Название блока</label>
        <input v-model="name" type="text" class="interactive-el" placeholder="Праздники середины года / Йул" />
      </div>

      <div class="flex items-center gap-2 mt-2">
        <label class="glass-checkbox-label">
          <input v-model="pauseWeek" type="checkbox" class="interactive-el" />
          <span>⏸️ Замораживать счет дней недели на время праздников</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarExtraDays } from './useCalendarExtraDays';
import type { CalendarExtraDaysProps, CalendarExtraDaysEmits } from './CalendarExtraDays.model';

const props = defineProps<CalendarExtraDaysProps>();
const emit = defineEmits<CalendarExtraDaysEmits>();

const { isCollapsed, baseDays, leapDays, pauseWeek, name } = useCalendarExtraDays(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarExtraDays.css"></style>
