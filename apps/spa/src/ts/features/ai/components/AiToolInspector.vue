<template>
  <AppDialog 
    :is-open="isOpen" 
    title="Диагностика и ручной запуск инструментов мира"
    max-width="700px"
    @close="closeModal"
  >
    <div class="tool-inspector-content">
      <div class="form-row-2 mb-3">
        <div class="form-group">
          <label>Инструмент</label>
          <select v-model="selectedTool" class="input-base">
            <option value="query_world">query_world (Поиск лора / Auto-RAG)</option>
            <option value="inspect_entity">inspect_entity (Анкета сущности)</option>
            <option value="read_manuscript">read_manuscript (Текст главы / список)</option>
          </select>
        </div>

        <div v-if="selectedTool === 'query_world'" class="form-group">
          <label>Область поиска (Scope)</label>
          <select v-model="scopeInput" class="input-base">
            <option value="all">Все (all)</option>
            <option value="entities">Только энциклопедия (entities)</option>
            <option value="chapters">Только рукопись (chapters)</option>
          </select>
        </div>
      </div>

      <div class="form-group mb-3">
        <label>
          {{ selectedTool === 'read_manuscript' ? 'ID главы (например, chapters:ch1 или list)' : 'Поисковый запрос / Имя сущности' }}
        </label>
        <div class="query-input-row">
          <input 
            v-model="queryInput" 
            type="text" 
            class="input-base" 
            placeholder="Введите запрос или имя..."
            @keyup.enter="executeTool"
          >
          <button 
            class="btn-primary" 
            :disabled="isLoading || !queryInput.trim()"
            @click="executeTool"
          >
            <i class="fas" :class="isLoading ? 'fa-spinner fa-spin' : 'fa-play'"></i>
            <span>{{ isLoading ? 'Выполнение...' : 'Запустить' }}</span>
          </button>
        </div>
      </div>

      <!-- Result section -->
      <div v-if="executionTimeMs !== null" class="result-stats mb-2">
        <span class="stat-badge" :class="resultError ? 'stat-error' : 'stat-success'">
          <i :class="resultError ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle'"></i>
          {{ resultError ? 'Ошибка' : 'Успешно' }}
        </span>
        <span class="stat-time"><i class="fas fa-stopwatch"></i> {{ executionTimeMs }}ms</span>
      </div>

      <div v-if="resultError" class="inspector-error-box">
        {{ resultError }}
      </div>

      <div v-if="resultJson" class="inspector-result-box">
        <pre>{{ resultJson }}</pre>
      </div>

      <div v-if="resultJson" class="inspector-actions mt-3">
        <button class="btn-secondary" @click="copyResult">
          <i class="fas fa-copy"></i> Скопировать JSON
        </button>
        <button class="btn-primary" @click="insertIntoContext">
          <i class="fas fa-plus-circle"></i> Вставить результат в контекст чата
        </button>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { AppDialog } from '@worldwiki/components';
import { 
  useAiToolInspector, 
  type AiToolInspectorProps, 
  type AiToolInspectorEmits 
} from './useAiToolInspector';

const props = defineProps<AiToolInspectorProps>();
const emit = defineEmits<AiToolInspectorEmits>();

const {
  selectedTool,
  queryInput,
  scopeInput,
  isLoading,
  executionTimeMs,
  resultJson,
  resultError,
  executeTool,
  copyResult,
  insertIntoContext,
  closeModal,
} = useAiToolInspector(props, emit);
</script>

<style scoped>
.tool-inspector-content {
  display: flex;
  flex-direction: column;
  color: var(--text-main);
  font-size: 13px;
}

.query-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.query-input-row input {
  flex: 1;
}

.result-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--border-radius-sm);
  font-weight: 600;
}

.stat-success {
  background: var(--bg-hover);
  color: var(--accent);
}

.stat-error {
  background: var(--bg-hover);
  color: var(--error);
}

.stat-time {
  color: var(--text-muted);
}

.inspector-result-box {
  max-height: 350px;
  overflow-y: auto;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  padding: 10px;
}

.inspector-result-box pre {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-main);
}

.inspector-error-box {
  background: var(--bg-hover);
  border: 1px solid var(--error);
  color: var(--error);
  padding: 10px;
  border-radius: var(--border-radius-md);
  font-size: 12px;
}

.inspector-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
