<template>
  <div class="surreal-presets flex items-center gap-1.5 flex-wrap overflow-x-auto py-1">
    <button
      v-for="p in presets"
      :key="p.label"
      type="button"
      class="preset-btn"
      :title="p.description + '\n' + p.query"
      @click="$emit('select', p)"
    >
      {{ p.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PresetQuery } from '../SurrealConsole.model';

defineProps<{
  presets: PresetQuery[];
}>();

defineEmits<{
  (e: 'select', preset: PresetQuery): void;
}>();
</script>

<style scoped>
.surreal-presets {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  padding: 4px 8px;
}

.preset-btn {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-focus);
}
</style>
