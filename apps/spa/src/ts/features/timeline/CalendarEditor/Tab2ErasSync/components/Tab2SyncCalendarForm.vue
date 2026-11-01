<template>
  <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;">
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Календарь другого поселения / культуры</label>
        <XboxWheel
          :model-value="targetCalendarId"
          :options="calendarOptions"
          @update:model-value="$emit('update-target-calendar', $event)"
        />
      </div>
      <div class="form-group">
        <label class="form-label">Когда там шёл год</label>
        <input
          type="number"
          class="form-input"
          :value="targetCalendarYear"
          min="1"
          :disabled="isReadOnly"
          @input="$emit('update-target-calendar-year', parseInt(($event.target as HTMLInputElement).value) || 1)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { Tab2SyncCalendarFormProps, Tab2SyncCalendarFormEmits } from './Tab2SyncCalendarForm.model';

defineProps<Tab2SyncCalendarFormProps>();

defineEmits<Tab2SyncCalendarFormEmits>();

const calendarOptions = [
  { value: 'julian', label: 'Юлианский календарь (Церковный)' },
  { value: 'padishah', label: 'Имперский Стандарт Падишаха' },
  { value: 'fremen', label: 'Цикл Сиетча Табр (Фременский)' },
];
</script>
