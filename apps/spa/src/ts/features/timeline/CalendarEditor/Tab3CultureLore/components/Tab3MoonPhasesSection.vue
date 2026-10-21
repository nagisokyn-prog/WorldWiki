<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">🌕 Лунные фазы в культуре (Спутник: Луна)</div>
        <div class="section-desc">
          Культурные имена фаз спутника используются автором в тексте рукописи: при вводе <code>((Кровавая Луна))</code> движок понимает астрономическую дату, а на таймлайне фаза подсвечивается именем.
        </div>
      </div>
      <button
        type="button"
        class="btn-ghost-sm"
        @click="$emit('find-double-full-moon')"
      >
        🔮 Найти Двойное Полнолуние
      </button>
    </div>

    <div class="grid-4" style="margin-top: 6px;">
      <div class="form-group">
        <label class="form-label">🌑 Новолуние (фаза 0.0)</label>
        <input
          :value="phaseNames.new"
          type="text"
          class="form-input"
          placeholder="Темная Ночь / Ночь Воров"
          :disabled="isReadOnly"
          @input="$emit('update-phase-names', { ...phaseNames, new: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="form-group">
        <label class="form-label">🌓 Растущая (фаза 0.25)</label>
        <input
          :value="phaseNames.waxing"
          type="text"
          class="form-input"
          placeholder="Серп Охотника"
          :disabled="isReadOnly"
          @input="$emit('update-phase-names', { ...phaseNames, waxing: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="form-group">
        <label class="form-label">🌕 Полнолуние (фаза 0.50)</label>
        <input
          :value="phaseNames.full"
          type="text"
          class="form-input"
          placeholder="Око Саурона / Кровавая Луна"
          :disabled="isReadOnly"
          @input="$emit('update-phase-names', { ...phaseNames, full: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="form-group">
        <label class="form-label">🌗 Убывающая (фаза 0.75)</label>
        <input
          :value="phaseNames.waning"
          type="text"
          class="form-input"
          placeholder="Ущерб / Тающий Лик"
          :disabled="isReadOnly"
          @input="$emit('update-phase-names', { ...phaseNames, waning: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MoonPhaseNames } from '@/services/Calendars/calendar.types';

defineProps<{
  phaseNames: MoonPhaseNames;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'update-phase-names', names: MoonPhaseNames): void;
  (e: 'find-double-full-moon'): void;
}>();
</script>
