<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="tool-inspector-overlay" @click.self="closeModal">
        <div class="tool-inspector-modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-terminal"></i> Диагностика и ручной тест инструментов</h3>
            <button class="close-btn" @click="closeModal">×</button>
          </div>

          <div class="tool-inspector-content">
            <div class="form-row-2 mb-3">
              <div class="form-group">
                <label class="form-label">Инструмент</label>
                <select v-model="selectedTool" class="input-base">
                  <option value="query_world">query_world (Поиск лора / Auto-RAG)</option>
                  <option value="inspect_entity">inspect_entity (Анкета сущности)</option>
                  <option value="read_manuscript">read_manuscript (Текст главы / список)</option>
                </select>
              </div>

              <div v-if="selectedTool === 'query_world'" class="form-group">
                <label class="form-label">Область поиска (Scope)</label>
                <select v-model="scopeInput" class="input-base">
                  <option value="all">Все (all)</option>
                  <option value="entities">Только энциклопедия (entities)</option>
                  <option value="chapters">Только рукопись (chapters)</option>
                </select>
              </div>
            </div>

            <div class="form-group mb-3">
              <label class="form-label">
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
                  class="btn-new btn-primary" 
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
              <button class="btn-new btn-outline-new" @click="copyResult">
                <i class="fas fa-copy"></i> Скопировать JSON
              </button>
              <button class="btn-new btn-primary" @click="insertIntoContext">
                <i class="fas fa-plus-circle"></i> Вставить в контекст чата
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
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
.tool-inspector-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop);
  backdrop-filter: blur(8px);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.tool-inspector-modal {
  width: 720px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), var(--shadow-lg);
  color: var(--text-main);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
}

.modal-title i {
  color: var(--accent);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  transition: color var(--anim-speed-fast);
}

.close-btn:hover {
  color: var(--text-main);
}

.tool-inspector-content {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px;
  gap: 12px;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
  display: block;
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
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.stat-success {
  background: var(--bg-card);
  color: var(--success);
}

.stat-error {
  background: var(--bg-card);
  color: var(--error);
}

.stat-time {
  color: var(--text-muted);
}

.inspector-result-box {
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-base);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
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
  background: var(--bg-base);
  border: 1px solid var(--error);
  color: var(--error);
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
}

.inspector-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--anim-speed-fast);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
