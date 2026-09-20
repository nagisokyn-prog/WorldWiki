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

<style scoped src="@worldwiki/resources/styles/features/ai/AiToolInspector.css"></style>
