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
import type { SurrealConsolePresetsProps, SurrealConsolePresetsEmits } from './SurrealConsolePresets.model';
import './SurrealConsolePresets.css';
import type { PresetQuery } from '../SurrealConsole.model';

defineProps<SurrealConsolePresetsProps>>();

defineEmits<SurrealConsolePresetsEmits>>();
</script>
