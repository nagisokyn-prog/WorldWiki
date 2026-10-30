<template>
  <div class="surreal-output-container flex-1 flex flex-col min-h-0 overflow-hidden">
    <div class="output-toolbar flex items-center justify-between px-3 py-1.5">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-muted">Результат запроса:</span>
        <span
          v-if="result"
          class="status-pill text-xs"
          :class="result.success ? 'status-ok' : 'status-err'"
        >
          {{ result.success ? 'Успешно' : 'Ошибка' }} ({{ result.durationMs }} мс)
        </span>
        <span v-if="result" class="text-xs text-muted">
          {{ result.timestamp }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="output"
          type="button"
          class="btn-xs btn-outline"
          title="Скопировать JSON результат в буфер обмена"
          @click="copyToClipboard"
        >
          {{ copied ? '✓ Скопировано' : '📋 Копировать' }}
        </button>
      </div>
    </div>

    <div class="output-viewer flex-1 min-h-0 overflow-auto p-3 font-mono text-xs">
      <div v-if="loading" class="flex items-center justify-center h-full text-muted gap-2">
        <span class="loading-spinner">⚡</span> Выполнение SurrealQL запроса...
      </div>
      <div v-else-if="!output" class="flex items-center justify-center h-full text-muted italic">
        Введите запрос SurrealQL или выберите пресет выше и нажмите Выполнить (Ctrl + Enter)
      </div>
      <pre v-else class="output-pre" :class="{ 'text-danger': result && !result.success }">{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SurrealConsoleOutputProps, SurrealConsoleOutputEmits } from './SurrealConsoleOutput.model';
import './SurrealConsoleOutput.css';
import type { QueryHistoryItem } from '../SurrealConsole.model';
import { useSurrealConsoleOutput } from './useSurrealConsoleOutput';

const props = defineProps<SurrealConsoleOutputProps>>();

const { copied, copyToClipboard } = useSurrealConsoleOutput(props);
</script>
