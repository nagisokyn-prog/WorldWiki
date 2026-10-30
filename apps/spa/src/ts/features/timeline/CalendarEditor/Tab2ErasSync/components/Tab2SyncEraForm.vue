<template>
  <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;">
    <div class="grid-3">
      <div class="form-group">
        <label class="form-label">Опорная эпоха в Календаре Мира</label>
        <select
          class="form-select"
          :value="selectedMasterEraIndex"
          :disabled="isReadOnly"
          @change="$emit('update-master-era', parseInt(($event.target as HTMLSelectElement).value) || 0)"
        >
          <option :value="-1">🌍 От начала Календаря Мира (Год 1)</option>
          <option v-for="(era, idx) in masterEras" :key="idx" :value="idx">
            🏛️ {{ era.название }} (с {{ era.год_начала }} г.)
          </option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Направление отсчёта</label>
        <div style="display: flex; gap: 12px; padding-top: 6px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input
              type="radio"
              name="sync-dir-era"
              value="after"
              :checked="offsetDirection === 'after'"
              :disabled="isReadOnly"
              @change="$emit('update-offset-direction', 'after')"
            />
            <span>После начала</span>
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input
              type="radio"
              name="sync-dir-era"
              value="before"
              :checked="offsetDirection === 'before'"
              :disabled="isReadOnly"
              @change="$emit('update-offset-direction', 'before')"
            />
            <span>До начала</span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Смещение (лет)</label>
        <input
          type="number"
          class="form-input"
          :value="offsetYears"
          min="0"
          :disabled="isReadOnly"
          @input="$emit('update-offset-years', parseInt(($event.target as HTMLInputElement).value) || 0)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab2SyncEraFormProps, Tab2SyncEraFormEmits } from './Tab2SyncEraForm.model';

defineProps<Tab2SyncEraFormProps>();

defineEmits<Tab2SyncEraFormEmits>();
</script>
