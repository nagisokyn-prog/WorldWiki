<template>
  <div class="models-tab">
    <div class="tab-intro">
      <h3>Настройка моделей и логики генерации</h3>
      <p class="text-muted">
        Выберите роли моделей для вашего творчества. Вы можете использовать мощную облачную модель для диалогов и локальную модель для мгновенного поиска по лору.
      </p>
    </div>

    <div v-if="localSettings" class="models-config-grid">
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
                :model-value="localSettings.model"
                :options="availableModelOptions"
                placeholder="Выберите или введите название модели"
                @update:model-value="val => localSettings!.model = val"
              />
            </div>
            <button 
              class="btn-secondary-outline" 
              :title="isFetchingModels ? 'Загрузка...' : 'Обновить список моделей из API / диска'"
              :disabled="isFetchingModels"
              @click="$emit('fetch-models', true)"
            >
              <i class="fas" :class="isFetchingModels ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
            </button>
          </div>
          <span v-if="fetchError" class="error-text">{{ fetchError }}</span>
          <span class="field-hint">
            {{ activeProfile?.provider === 'local' ? 'Выберите скачанный .gguf файл из списка' : 'Например: anthropic/claude-3.5-sonnet, openai/gpt-4o или qwen2.5-14b' }}
          </span>
        </div>

        <div class="form-group">
          <label>Политика выполнения (Режим работы)</label>
          <div class="execution-policies">
            <label 
              class="policy-card" 
              :class="{ active: (localSettings.execution_policy || 'agentic') === 'direct' }"
            >
              <input 
                v-model="localSettings.execution_policy" 
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
              :class="{ active: localSettings.execution_policy === 'tool_assisted' }"
            >
              <input 
                v-model="localSettings.execution_policy" 
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
              :class="{ active: localSettings.execution_policy === 'agentic' }"
            >
              <input 
                v-model="localSettings.execution_policy" 
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
              v-model="localSettings.enable_auto_rag" 
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
              v-model="localSettings.enable_semantic_search" 
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
          <select 
            v-model="localSettings.embed_model_path" 
            class="input-base"
          >
            <option value="">-- Выберите модель эмбеддингов --</option>
            <optgroup v-if="installedModels.length > 0" label="Скачанные локальные модели (GGUF)">
              <option v-for="m in installedModels" :key="m.filename" :value="m.filename">
                {{ m.name }} ({{ m.filename }})
              </option>
            </optgroup>
            <optgroup label="Облачные API (OpenRouter / OpenAI)">
              <option value="nvidia/nemotron-3-embed">NVIDIA Nemotron-3 Embed (2048 dim)</option>
              <option value="openai/text-embedding-3-small">OpenAI text-embedding-3-small (1536 dim)</option>
              <option value="openai/text-embedding-3-large">OpenAI text-embedding-3-large (3072 dim)</option>
            </optgroup>
            <option value="custom">Пользовательский путь или название...</option>
          </select>

          <!-- Поле для ручного ввода, если выбрана кастомная опция или путь не из списка -->
          <input 
            v-if="isCustomEmbedPath" 
            v-model="customEmbedInput" 
            type="text" 
            class="input-base" 
            style="margin-top: 6px;" 
            placeholder="Путь к локальному .gguf или имя модели в API" 
            @input="onCustomEmbedInput" 
          />
        </div>
      </div>

      <!-- Блок 3: Параметры генерации -->
      <div class="config-card">
        <div class="card-header">
          <i class="fas fa-sliders-h text-primary"></i>
          <h4>Параметры инференса и креативности</h4>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <div class="slider-header">
              <label>Температура (Креативность)</label>
              <span class="slider-value">{{ localSettings.temperature }}</span>
            </div>
            <input 
              v-model.number="localSettings.temperature" 
              type="range" 
              min="0" 
              max="2" 
              step="0.05" 
              class="range-slider" 
            />
            <div class="slider-marks">
              <span>0.0 (Факты)</span>
              <span>0.7 (Баланс)</span>
              <span>1.5+ (Фантазия)</span>
            </div>
          </div>

          <div class="form-group">
            <div class="slider-header">
              <label>Top-P (Ядерная выборка)</label>
              <span class="slider-value">{{ localSettings.top_p }}</span>
            </div>
            <input 
              v-model.number="localSettings.top_p" 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              class="range-slider" 
            />
            <div class="slider-marks">
              <span>0.1 (Строго)</span>
              <span>0.9 (Обычно)</span>
              <span>1.0 (Все токены)</span>
            </div>
          </div>
        </div>

        <div class="form-row-2" style="margin-top: 10px;">
          <div class="form-group">
            <label>Максимум токенов ответа (Max Output Tokens)</label>
            <input 
              v-model.number="localSettings.max_tokens" 
              type="number" 
              class="input-base" 
              placeholder="Например: 4096 (Оставьте пустым для авто)" 
            />
          </div>

          <div class="form-group">
            <label>Штраф за повторы (Presence / Frequency Penalty)</label>
            <input 
              v-model.number="localSettings.frequency_penalty" 
              type="number" 
              step="0.1" 
              min="-2" 
              max="2" 
              class="input-base" 
              placeholder="0.0" 
            />
          </div>
        </div>

        <div class="form-group" style="margin-top: 6px;">
          <label class="toggle-row">
            <input 
              v-model="localSettings.enable_streaming" 
              type="checkbox" 
            />
            <div class="toggle-text">
              <span class="toggle-title">Потоковая генерация ответов (Streaming)</span>
              <span class="toggle-desc">Показывает текст по буквам в реальном времени по мере создания нейросетью.</span>
            </div>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-primary" @click="handleSave">
          <i class="fas fa-check"></i> Сохранить настройки моделей
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { AiModelInfo, AiProfile, AiProfileSettings, InstalledModelInfo } from '../../types/ai.types';
import AiSelect from '../../components/AiSelect.vue';

const props = defineProps<{
  activeProfile: AiProfile | null;
  availableModels: AiModelInfo[];
  isFetchingModels: boolean;
  fetchError: string | null;
}>();

const emit = defineEmits(['save-profile', 'fetch-models']);

const localSettings = ref<AiProfileSettings | null>(null);
const installedModels = ref<InstalledModelInfo[]>([]);
const customEmbedInput = ref('');

const standardEmbedOptions = [
  '',
  'nvidia/nemotron-3-embed',
  'openai/text-embedding-3-small',
  'openai/text-embedding-3-large',
];

const isCustomEmbedPath = computed(() => {
  if (!localSettings.value?.embed_model_path) return false;
  if (localSettings.value.embed_model_path === 'custom') return true;
  const inInstalled = installedModels.value.some((m: InstalledModelInfo) => m.filename === localSettings.value?.embed_model_path);
  const inStandard = standardEmbedOptions.includes(localSettings.value.embed_model_path);
  return !inInstalled && !inStandard;
});

onMounted(async () => {
  await loadInstalledModels();
});

const loadInstalledModels = async () => {
  try {
    const list = await invoke<InstalledModelInfo[]>('list_installed_models');
    installedModels.value = list || [];
  } catch (e) {
    console.error('Ошибка загрузки локальных моделей:', e);
  }
};

watch(() => props.activeProfile?.settings, (newSettings) => {
  if (newSettings) {
    localSettings.value = { ...newSettings };
    if (isCustomEmbedPath.value) {
      customEmbedInput.value = localSettings.value.embed_model_path || '';
    }
  } else {
    localSettings.value = null;
  }
}, { immediate: true, deep: true });

const onCustomEmbedInput = () => {
  if (localSettings.value) {
    localSettings.value.embed_model_path = customEmbedInput.value;
  }
};

const handleSave = () => {
  if (localSettings.value) {
    if (localSettings.value.embed_model_path === 'custom') {
      localSettings.value.embed_model_path = customEmbedInput.value;
    }
    emit('save-profile', { settings: localSettings.value });
  }
};

const availableModelOptions = computed(() => {
  return props.availableModels.map((m: AiModelInfo) => ({
    value: m.value,
    label: m.label,
    description: m.description,
  }));
});
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsModelsTab.css"></style>
