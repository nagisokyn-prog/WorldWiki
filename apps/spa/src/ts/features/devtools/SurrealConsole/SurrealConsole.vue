<template>
  <div class="surreal-console-root flex flex-col flex-1 min-h-0 overflow-hidden">
    <!-- 1. Верхний тулбар пресетов -->
    <SurrealConsolePresets
      :presets="presets"
      @select="selectPreset"
    />

    <!-- 2. Область ввода запроса и действий -->
    <div class="query-input-bar flex flex-col p-2 gap-2">
      <div class="flex items-center gap-2">
        <div class="flex-1 relative flex items-center">
          <textarea
            v-model="queryInput"
            rows="2"
            class="query-textarea font-mono text-xs flex-1"
            placeholder="Введите SurrealQL запрос (например, SELECT * FROM chapters;) ... [Ctrl+Enter для запуска]"
            :disabled="isLoading"
            @keydown.enter.ctrl.prevent="executeQuery()"
            @keydown.up="handleKeyUp"
            @keydown.down="handleKeyDown"
          ></textarea>
        </div>
        <div class="flex flex-col gap-1.5">
          <button
            type="button"
            class="btn-sm btn-primary flex items-center gap-1"
            :disabled="isLoading || !queryInput.trim()"
            @click="executeQuery()"
          >
            <span>▶</span>
            <span>{{ isLoading ? 'Выполняется...' : 'Выполнить' }}</span>
          </button>
          <button
            v-if="history.length > 0"
            type="button"
            class="btn-xs btn-subtle"
            title="Очистить историю запросов"
            @click="clearHistory"
          >
            Очистить
          </button>
        </div>
      </div>
    </div>

    <!-- 3. Область вывода результата -->
    <div class="flex-1 min-h-0 flex flex-col p-2 pt-0 overflow-hidden">
      <SurrealConsoleOutput
        :output="formattedOutput"
        :result="activeResult"
        :loading="isLoading"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import './SurrealConsole.css';
import type { SurrealConsoleProps } from './SurrealConsole.model';
import { useSurrealConsole } from './useSurrealConsole';
import SurrealConsolePresets from './components/SurrealConsolePresets.vue';
import SurrealConsoleOutput from './components/SurrealConsoleOutput.vue';

const props = defineProps<SurrealConsoleProps>();

const {
  queryInput,
  isLoading,
  history,
  activeResult,
  presets,
  formattedOutput,
  executeQuery,
  selectPreset,
  clearHistory,
  handleKeyUp,
  handleKeyDown,
} = useSurrealConsole(props);
</script>
