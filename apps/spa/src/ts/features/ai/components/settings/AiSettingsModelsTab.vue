<template>
  <div class="models-tab">
    <div class="tab-intro">
      <h3>Настройка моделей и логики генерации</h3>
      <p class="text-muted">
        Выберите роли моделей для вашего творчества. Вы можете использовать мощную облачную модель для диалогов и локальную модель для мгновенного поиска по лору.
      </p>
    </div>

    <div v-if="activeProfile" class="models-config-grid">
      <!-- Блок 1: Основная модель для чата и письма -->
      <div class="config-card">
        <div class="card-header">
          <i class="fas fa-feather-alt text-primary"></i>
          <h4>Основная модель (Текст и Диалоги)</h4>
        </div>
        
        <div class="form-group">
          <label>Модель</label>
          <div style="display: flex; gap: 8px;">
            <div style="flex: 1;">
              <AiSelect
                :model-value="activeProfile.settings.model"
                :options="availableModelOptions"
                placeholder="Выберите или введите название модели"
                @update:model-value="val => activeProfile!.settings.model = val"
              />
            </div>
            <button 
              class="btn-secondary-outline" 
              :title="isFetchingModels ? 'Загрузка...' : 'Обновить список моделей из API'"
              :disabled="isFetchingModels"
              @click="$emit('fetch-models', true)"
            >
              <i class="fas" :class="isFetchingModels ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
            </button>
          </div>
          <span v-if="fetchError" class="error-text">{{ fetchError }}</span>
          <span class="field-hint">Например: <code>anthropic/claude-3.5-sonnet</code>, <code>openai/gpt-4o</code> или <code>qwen2.5-14b</code></span>
        </div>

        <div class="form-group">
          <label>Политика выполнения (Режим работы)</label>
          <div class="execution-policies">
            <label 
              class="policy-card" 
              :class="{ active: (activeProfile.settings.execution_policy || 'agentic') === 'direct' }"
            >
              <input 
                v-model="activeProfile.settings.execution_policy" 
                type="radio" 
                value="direct" 
              />
              <div class="policy-info">
                <span class="policy-title"><i class="fas fa-comment-dots"></i> Прямой ответ</span>
                <span class="policy-desc">Без инструментов. Самый быстрый ответ, экономит токены.</span>
              </div>
            </label>

            <label 
              class="policy-card" 
              :class="{ active: activeProfile.settings.execution_policy === 'tool_assisted' }"
            >
              <input 
                v-model="activeProfile.settings.execution_policy" 
                type="radio" 
                value="tool_assisted" 
              />
              <div class="policy-info">
                <span class="policy-title"><i class="fas fa-tools"></i> С инструментами</span>
                <span class="policy-desc">Один проход: поиск по базе/главам и сразу готовый ответ.</span>
              </div>
            </label>

            <label 
              class="policy-card" 
              :class="{ active: activeProfile.settings.execution_policy === 'agentic' }"
            >
              <input 
                v-model="activeProfile.settings.execution_policy" 
                type="radio" 
                value="agentic" 
              />
              <div class="policy-info">
                <span class="policy-title"><i class="fas fa-robot"></i> Автономный агент</span>
                <span class="policy-desc">Многошаговый цикл рассуждений для сложных писательских задач.</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Блок 2: База знаний и Auto-RAG -->
      <div class="config-card">
        <div class="card-header">
          <i class="fas fa-brain text-accent"></i>
          <h4>Поиск по лору и База знаний (Auto-RAG)</h4>
        </div>

        <div class="form-group">
          <label class="toggle-row">
            <input 
              v-model="activeProfile.settings.enable_auto_rag" 
              type="checkbox" 
            />
            <div class="toggle-text">
              <span class="toggle-title">Включить автоматический контекстный поиск (Auto-RAG)</span>
              <span class="toggle-desc">WorldWiki сам найдёт релевантные факты из энциклопедии перед отправкой запроса нейросети.</span>
            </div>
          </label>
        </div>

        <div class="form-group">
          <label class="toggle-row">
            <input 
              v-model="activeProfile.settings.enable_semantic_search" 
              type="checkbox" 
            />
            <div class="toggle-text">
              <span class="toggle-title">Гибридный векторный поиск (HNSW + BM25)</span>
              <span class="toggle-desc">Объединяет точный поиск по словам и глубокий поиск по смыслу через эмбеддинги.</span>
            </div>
          </label>
        </div>

        <div class="form-group" style="margin-top: 10px;">
          <label>Модель эмбеддингов для лора</label>
          <input 
            v-model="activeProfile.settings.embed_model_path" 
            type="text" 
            class="input-base" 
            placeholder="nvidia/nemotron-3-embed-gguf или путь к GGUF" 
          />
          <span class="field-hint">Рекомендуется: <code>nemotron-3-embed</code> (2048 измерений для максимальной точности).</span>
        </div>
      </div>

      <!-- Блок 3: Параметры генерации -->
      <div class="config-card">
        <div class="card-header">
          <i class="fas fa-sliders-h"></i>
          <h4>Параметры генерации</h4>
        </div>

        <div class="form-group">
          <div class="slider-header">
            <label>Температура (Креативность)</label>
            <span class="slider-value">{{ activeProfile.settings.temperature }}</span>
          </div>
          <input 
            v-model.number="activeProfile.settings.temperature" 
            type="range" 
            min="0" 
            max="1.5" 
            step="0.05" 
            class="range-slider" 
          />
          <div class="slider-marks">
            <span>0.0 (Строгий лор)</span>
            <span>0.7 (Баланс)</span>
            <span>1.5 (Свободное творчество)</span>
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label>Максимум токенов вывода</label>
            <input 
              v-model.number="activeProfile.settings.max_tokens" 
              type="number" 
              class="input-base" 
              placeholder="4096" 
            />
          </div>

          <div class="form-group">
            <label>Уровень рассуждений (CoT)</label>
            <select v-model="activeProfile.settings.reasoning_effort" class="input-base">
              <option value="none">Отключено</option>
              <option value="low">Низкий (Быстро)</option>
              <option value="medium">Средний (Сбалансировано)</option>
              <option value="high">Высокий (Глубокий анализ)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Таймаут выполнения (минуты)</label>
          <input 
            v-model.number="activeProfile.settings.timeout_mins" 
            type="number" 
            class="input-base" 
            placeholder="30" 
          />
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-primary" @click="$emit('save-profile')">
          <i class="fas fa-check"></i> Сохранить настройки моделей
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AiModelInfo, AiProfile } from '../../types/ai.types';
import AiSelect from '../AiSelect.vue';

const props = defineProps<{
  activeProfile: AiProfile | null;
  availableModels: AiModelInfo[];
  isFetchingModels: boolean;
  fetchError: string | null;
}>();

defineEmits(['save-profile', 'fetch-models']);

const availableModelOptions = computed(() => {
  return props.availableModels.map(m => ({
    value: m.value,
    label: m.label,
    description: m.description,
  }));
});
</script>

<style scoped>
.models-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.tab-intro h3 {
  margin: 0 0 6px 0;
  font-size: 18px;
  color: var(--text-color, #fff);
}
.text-muted {
  color: var(--text-muted, #8b949e);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}
.models-config-grid {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.config-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 8px;
}
.card-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color, #e6edf3);
}
.text-primary {
  color: #58a6ff;
}
.text-accent {
  color: #bc8cff;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #e6edf3);
}
.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.field-hint {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.error-text {
  font-size: 12px;
  color: #f85149;
}
.execution-policies {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 4px;
}
.policy-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
}
.policy-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}
.policy-card.active {
  background: rgba(88, 166, 255, 0.1);
  border-color: #58a6ff;
}
.policy-card input[type="radio"] {
  margin-top: 3px;
}
.policy-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.policy-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #fff);
}
.policy-desc {
  font-size: 11px;
  color: var(--text-muted, #8b949e);
  line-height: 1.3;
}
.toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}
.toggle-row input[type="checkbox"] {
  margin-top: 3px;
  transform: scale(1.15);
}
.toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toggle-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #e6edf3);
}
.toggle-desc {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.slider-value {
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #58a6ff;
}
.range-slider {
  width: 100%;
  accent-color: #58a6ff;
}
.slider-marks {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted, #8b949e);
}
</style>
