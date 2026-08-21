<template>
  <div class="tab-pane">
    <div v-if="!activeProfile" class="loading-state">
      Загрузка профиля...
    </div>
    
    <div v-else class="provider-tab-content">
      <div class="form-group">
        <label>Имя профиля</label>
        <input :value="activeProfile.name" type="text" class="input-base" placeholder="Например: Дефолтный GPT-4" @input="updateField('name', ($event.target as HTMLInputElement).value)">
      </div>
      
      <div class="form-group">
        <label>Провайдер</label>
        <AiSelect 
          :model-value="activeProfile.provider" 
          :options="providerOptions" 
          placeholder="Выберите провайдера"
          @update:model-value="(val: any) => { updateField('provider', val); onProviderChange(); }"
        />
      </div>
      
      <div v-if="activeProfile.provider === 'local' || activeProfile.provider === 'openai'" class="form-group">
        <label>Base URL <span class="text-muted">(опционально)</span></label>
        <input :value="activeProfile.base_url" type="text" class="input-base" placeholder="Например: http://localhost:11434/v1" @input="updateField('base_url', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="activeProfile.provider !== 'local'" class="form-group">
        <label>API Key</label>
        <input :value="activeProfile.api_key" type="password" class="input-base" placeholder="Введите ключ API" @input="updateField('api_key', ($event.target as HTMLInputElement).value)">
      </div>

      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label>Модель <span v-if="isFetchingModels" class="text-muted">(Загрузка...)</span></label>
          <button class="back-btn" style="font-size: 11px;" @click="$emit('fetch-models', true)">
            <i class="fas fa-sync-alt" :class="{'fa-spin': isFetchingModels}"></i> Обновить
          </button>
        </div>
        
        <AiSelect 
          :model-value="activeProfile.settings.model" 
          :options="availableModels" 
          placeholder="Выберите модель или введите вручную"
          :allow-custom="true"
          @update:model-value="(val: any) => updateSetting('model', val)"
        />
        
        <div v-if="fetchError" class="hint" style="color: var(--error);">
          {{ fetchError }}
        </div>

        <AiModelInfoCard 
          :model="selectedModelInfo"
          @recommend="recommendModel"
        />
      </div>

      <!-- Advanced Settings Accordion -->
      <div class="advanced-settings-accordion">
        <button class="accordion-trigger" @click="isAdvancedOpen = !isAdvancedOpen">
          <i class="fas" :class="isAdvancedOpen ? 'fa-chevron-down' : 'fa-chevron-right'"></i> 
          Дополнительные настройки
        </button>
        <div v-if="isAdvancedOpen" class="accordion-content">
          
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input :checked="activeProfile.settings.enable_task_list" type="checkbox" @change="updateSetting('enable_task_list', ($event.target as HTMLInputElement).checked)">
              <span>Включить инструмент списка задач</span>
            </label>
            <span class="hint">При включении ИИ может создавать и управлять списками задач для отслеживания прогресса.</span>
          </div>
          
          <div class="form-group">
            <label>Уровень размышлений (Reasoning Effort)</label>
            <select :value="activeProfile.settings.reasoning_effort" class="input-base" @change="updateSetting('reasoning_effort', ($event.target as HTMLSelectElement).value)">
              <option value="none">Без ограничений (Отключено)</option>
              <option value="low">Низкий (Low)</option>
              <option value="medium">Средний (Medium)</option>
              <option value="high">Высокий (High)</option>
              <option value="xhigh">Экстремальный (XHigh)</option>
            </select>
            <span class="hint">Управляет "бюджетом" токенов на внутренние рассуждения модели (только для поддерживаемых моделей, например o1/o3-mini).</span>
          </div>

          <div class="form-group">
            <label>Таймаут ИИ (в минутах)</label>
            <input :value="activeProfile.settings.timeout_mins" type="number" min="1" max="1440" class="input-base" placeholder="Например: 30" @input="updateSetting('timeout_mins', Number(($event.target as HTMLInputElement).value))">
            <span class="hint">Максимальное время, которое агент может работать в фоне, пока не будет прерван принудительно (по умолчанию 30 мин).</span>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input :checked="activeProfile.settings.use_custom_temperature" type="checkbox" @change="updateSetting('use_custom_temperature', ($event.target as HTMLInputElement).checked)">
              <span>Использовать пользовательскую температуру</span>
            </label>
            <span class="hint">Управляет случайностью ответов модели.</span>
          </div>

          <div v-if="activeProfile.settings.use_custom_temperature" class="form-group" style="margin-left: 24px;">
            <div style="display: flex; justify-content: space-between;">
              <label>Температура</label>
              <span>{{ activeProfile.settings.temperature ?? 1.0 }}</span>
            </div>
            <input :value="activeProfile.settings.temperature" type="range" min="0" max="2" step="0.1" class="range-slider" @input="updateSetting('temperature', Number(($event.target as HTMLInputElement).value))">
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label>Лимит скорости</label>
              <span>{{ activeProfile.settings.rate_limit_ms ?? 0 }}ms</span>
            </div>
            <input :value="activeProfile.settings.rate_limit_ms" type="range" min="0" max="5000" step="100" class="range-slider" @input="updateSetting('rate_limit_ms', Number(($event.target as HTMLInputElement).value))">
            <span class="hint">Минимальное время между запросами к API.</span>
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label>Лимит ошибок и повторений</label>
              <span>{{ activeProfile.settings.error_retry_limit ?? 3 }}</span>
            </div>
            <input :value="activeProfile.settings.error_retry_limit" type="range" min="0" max="10" step="1" class="range-slider" @input="updateSetting('error_retry_limit', Number(($event.target as HTMLInputElement).value))">
            <span class="hint">Количество последовательных ошибок или повторных действий перед показом диалогового окна. Установите 0, чтобы отключить этот механизм.</span>
          </div>

          <!-- Local LLM Settings -->
          <div v-if="activeProfile.provider === 'local'" class="local-llm-settings" style="border: 1px solid var(--border-color, #444); border-radius: 8px; padding: 12px; margin-bottom: 16px; background: rgba(255,255,255,0.02);">
            <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>🦙 Параметры локального инференса (llama-turboquant-cpp)</span>
            </div>

            <div class="form-group">
              <label>Размер контекста (n_ctx)</label>
              <input :value="activeProfile.settings.n_ctx ?? 8192" type="number" min="512" max="131072" step="512" class="input-base" placeholder="8192" @input="updateSetting('n_ctx', Number(($event.target as HTMLInputElement).value))">
              <span class="hint">Количество токенов контекстного окна модели.</span>
            </div>

            <div class="form-group">
              <label>Слои на GPU (n_gpu_layers)</label>
              <input :value="activeProfile.settings.n_gpu_layers ?? -1" type="number" min="-1" max="120" class="input-base" placeholder="-1 (все слои)" @input="updateSetting('n_gpu_layers', Number(($event.target as HTMLInputElement).value))">
              <span class="hint">-1 означает полную загрузку модели в память видеокарты (VRAM).</span>
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input :checked="activeProfile.settings.enable_tcq ?? true" type="checkbox" @change="updateSetting('enable_tcq', ($event.target as HTMLInputElement).checked)">
                <span>TCQ (Trellis-Coded Quantization KV-cache)</span>
              </label>
              <span class="hint">Сжатие KV кэша в 7 раз без потери точности для экономии VRAM.</span>
            </div>

            <div class="form-group">
              <label>Модель эмбеддингов для Auto-RAG поиска <span class="text-muted">(.gguf)</span></label>
              <input :value="activeProfile.settings.embed_model_path" type="text" class="input-base" placeholder="Путь к Nemotron/Nomic .gguf модели для поиска" @input="updateSetting('embed_model_path', ($event.target as HTMLInputElement).value)">
              <span class="hint">Если указана, база данных автоматически ищет факты через эмбеддинги без затрат на вызовы инструментов.</span>
            </div>

            <div class="form-group">
              <label>Файл калибровки TriAttention <span class="text-muted">(.triattention)</span></label>
              <input :value="activeProfile.settings.triattention_path" type="text" class="input-base" placeholder="Путь к файлу .triattention (опционально)" @input="updateSetting('triattention_path', ($event.target as HTMLInputElement).value)">
              <span class="hint">Калиброванная эвикция KV кэша для сверхдлинных контекстов.</span>
            </div>
          </div>

          <div class="form-group">
            <label>Custom Instructions (Системный промпт)</label>
            <textarea :value="activeProfile.settings.custom_instructions" class="input-base" rows="3" placeholder="Дополнительные инструкции для этого профиля..." @input="updateSetting('custom_instructions', ($event.target as HTMLTextAreaElement).value)"></textarea>
          </div>
        </div>
      </div>
      
      <button class="btn-primary" style="margin-top: 15px;" @click="$emit('save-profile')">Сохранить профиль</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import AiSelect from '../AiSelect.vue';
import AiModelInfoCard from './AiModelInfoCard.vue';
import type { AiProfile, AiModelInfo } from '../../types/ai.types';

const props = defineProps<{
  activeProfile: AiProfile | null;
  availableModels: AiModelInfo[];
  isFetchingModels: boolean;
  fetchError: string;
}>();

const emit = defineEmits(['fetch-models', 'save-profile', 'provider-changed']);

const isAdvancedOpen = ref(false);

const updateField = <K extends keyof AiProfile>(field: K, value: AiProfile[K]) => {
  if (props.activeProfile) {
    // eslint-disable-next-line vue/no-mutating-props
    props.activeProfile[field] = value;
  }
};

const updateSetting = <K extends keyof AiProfile['settings']>(field: K, value: AiProfile['settings'][K]) => {
  if (props.activeProfile && props.activeProfile.settings) {
    // eslint-disable-next-line vue/no-mutating-props
    props.activeProfile.settings[field] = value;
  }
};

const providerOptions = [
  { value: 'anthropic', label: 'Anthropic (Claude)', description: 'Официальный API Anthropic' },
  { value: 'openai', label: 'OpenAI (GPT)', description: 'Официальный API OpenAI' },
  { value: 'gemini', label: 'Google Gemini', description: 'Официальный API Google' },
  { value: 'openrouter', label: 'OpenRouter', description: 'Агрегатор 100+ моделей' },
  { value: 'local', label: 'Локальная / OpenAI Compatible', description: 'Ollama, LM Studio, vLLM' },
];

const selectedModelInfo = computed(() => {
  if (!props.activeProfile || !props.availableModels) return null;
  const target = props.activeProfile.settings.model;
  return props.availableModels.find(m => m.value === target) || null;
});

const onProviderChange = () => {
  emit('provider-changed');
};

const recommendModel = (modelId: string) => {
  updateSetting('model', modelId);
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsProviderTab.css"></style>
