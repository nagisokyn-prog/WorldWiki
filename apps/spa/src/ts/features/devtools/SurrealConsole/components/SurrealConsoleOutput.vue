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
      <pre v-else :class="{ 'text-danger': result && !result.success }">{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { QueryHistoryItem } from '../SurrealConsole.model';

const props = defineProps<{
  output: string;
  result: QueryHistoryItem | null;
  loading: boolean;
}>();

const copied = ref(false);

const copyToClipboard = async () => {
  if (!props.output) return;
  try {
    await navigator.clipboard.writeText(props.output);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // ignore
  }
};
</script>

<style scoped>
.surreal-output-container {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.output-toolbar {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.status-pill {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: bold;
}

.status-ok {
  background: var(--color-success-bg, rgba(46, 204, 113, 0.15));
  color: var(--color-success, #2ecc71);
}

.status-err {
  background: var(--color-danger-bg, rgba(231, 76, 60, 0.15));
  color: var(--color-danger, #e74c3c);
}

.output-viewer {
  background: var(--bg-editor, var(--bg-base));
  line-height: 1.5;
  user-select: text;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}

.text-danger {
  color: var(--color-danger, #e74c3c);
}

.loading-spinner {
  display: inline-block;
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.4; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1.1); }
}
</style>
