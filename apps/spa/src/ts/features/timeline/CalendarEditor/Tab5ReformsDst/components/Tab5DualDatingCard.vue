<template>
  <div class="section-card" style="background: var(--info-bg); border: 1px solid var(--border-accent);">
    <div class="section-header" style="margin-bottom: 8px;">
      <div>
        <div class="section-title" style="color: var(--accent-primary); font-size: 13px;">
          🧮 Проверка двойной датировки для рукописи (Старый и Новый стиль)
        </div>
        <div class="section-desc">
          Введите дату любого исторического события в романе, чтобы увидеть, как она записывается в обоих стилях и какова ее точка M_abs.
        </div>
      </div>
    </div>
    <div class="grid-3" style="align-items: end; margin-bottom: 10px;">
      <div class="form-group">
        <label class="form-label">День месяца</label>
        <input type="number" class="form-input" :value="dualDatingInput.day" min="1" max="31" :disabled="isReadOnly" @input="$emit('update-dual-input', { day: +($event.target as HTMLInputElement).value })" />
      </div>
      <div class="form-group">
        <label class="form-label">Месяц</label>
        <select class="form-select" :value="dualDatingInput.month" :disabled="isReadOnly" @change="$emit('update-dual-input', { month: +($event.target as HTMLSelectElement).value })">
          <option v-for="(m, i) in monthNames" :key="i" :value="i + 1">{{ m }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Год события</label>
        <input type="number" class="form-input" :value="dualDatingInput.year" :disabled="isReadOnly" @input="$emit('update-dual-input', { year: +($event.target as HTMLInputElement).value })" />
      </div>
    </div>
    <div class="grid-3" style="background: var(--bg-surface); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
      <div>
        <span style="font-size: 11px; color: var(--text-muted); display: block;">Старый стиль (O.S.):</span>
        <strong style="font-size: 14px; color: var(--text-main);">{{ dualDatingResult.osDateStr }}</strong>
      </div>
      <div>
        <span style="font-size: 11px; color: var(--text-muted); display: block;">Новый стиль (N.S.):</span>
        <strong style="font-size: 14px; color: var(--accent-primary);">{{ dualDatingResult.nsDateStr }}</strong>
      </div>
      <div>
        <span style="font-size: 11px; color: var(--text-muted); display: block;">Мировая минута (M_abs):</span>
        <strong style="font-size: 13px; font-family: var(--font-mono); color: var(--accent-purple);">{{ dualDatingResult.mabsMinutes.toLocaleString('ru-RU') }} мин</strong>
      </div>
    </div>
    <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
      💡 <em>В тексте черновика автор может писать:</em> <strong style="color: var(--text-main);">{{ dualDatingResult.quoteStr }}</strong>.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DualDatingInput, DualDatingResult } from '../Tab5ReformsDst.model';

defineProps<{
  monthNames: string[];
  dualDatingInput: DualDatingInput;
  dualDatingResult: DualDatingResult;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'update-dual-input', patch: Partial<DualDatingInput>): void;
}>();
</script>
