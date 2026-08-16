<template>
  <div class="calendar-settings-section">
    <h4><i class="fas fa-globe"></i> Часовые пояса</h4>
    <p class="help-text" style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
      Добавьте часовые пояса, чтобы события в разных регионах мира автоматически пересчитывались в мировое время (смещение в минутах).
    </p>

    <div v-auto-animate class="moons-list">
      <div v-for="(tz, idx) in timezoneRegions" :key="tz.id" class="moon-item glass-panel" style="margin-bottom: 8px; padding: 8px;">
        <div class="grid-2">
          <div class="calendar-field">
            <label>Название региона</label>
            <input v-model="tz.name" type="text" class="interactive-el" @input="updateParent">
          </div>
          <div class="calendar-field">
            <label>Смещение (минут)</label>
            <input v-model.number="tz.offset_minutes" type="number" class="interactive-el" @input="updateParent">
          </div>
        </div>
        <button type="button" class="delete-btn" style="margin-top: 8px; width: 100%" @click="removeTz(idx)">Удалить пояс</button>
      </div>
    </div>

    <button type="button" class="btn-new btn-outline-new interactive-el" style="width: 100%; justify-content: center;" @click="addTz">
      + Добавить часовой пояс
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCalendarTimezones } from './useCalendarTimezones';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

const props = defineProps<{ modelValue: CalendarData }>();
const emit = defineEmits(['update:modelValue']);

const { timezoneRegions, updateParent, addTz, removeTz } = useCalendarTimezones(props, emit);
</script>
