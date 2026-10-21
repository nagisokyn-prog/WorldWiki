<template>
  <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;">
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Календарь другого поселения / культуры</label>
        <select
          class="form-select"
          :value="targetCalendarId"
          :disabled="isReadOnly"
          @change="$emit('update-target-calendar', ($event.target as HTMLSelectElement).value)"
        >
          <option value="julian">Юлианский календарь (Церковный)</option>
          <option value="padishah">Имперский Стандарт Падишаха</option>
          <option value="fremen">Цикл Сиетча Табр (Фременский)</option>
        </select>
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
defineProps<{
  targetCalendarId: string;
  targetCalendarYear: number;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'update-target-calendar', calId: string): void;
  (e: 'update-target-calendar-year', year: number): void;
}>();
</script>
