<template>
  <div class="tab-pane">
    <div v-if="!activeProfile" class="loading-state">
      Загрузка профиля...
    </div>
    
    <div v-else class="provider-tab-content">
      <div class="form-group">
        <label>Имя профиля</label>
        <input type="text" v-model="activeProfile.name" class="input-base" placeholder="Например: Дефолтный GPT-4">
      </div>
      
      <div class="form-group">
        <label>Провайдер</label>
        <AiSelect 
          v-model="activeProfile.provider" 
          :options="providerOptions" 
          placeholder="Выберите провайдера"
          @update:modelValue="onProviderChange"
        />
      </div>
      
      <div class="form-group" v-if="activeProfile.provider === 'local' || activeProfile.provider === 'openai'">
        <label>Base URL <span class="text-muted">(опционально)</span></label>
        <input type="text" v-model="activeProfile.base_url" class="input-base" placeholder="Например: http://localhost:11434/v1">
      </div>

      <div class="form-group" v-if="activeProfile.provider !== 'local'">
        <label>API Key</label>
        <input type="password" v-model="activeProfile.api_key" class="input-base" placeholder="Введите ключ API">
      </div>

      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label>Модель <span v-if="isFetchingModels" class="text-muted">(Загрузка...)</span></label>
          <button class="back-btn" @click="$emit('fetch-models', true)" style="font-size: 11px;">
            <i class="fas fa-sync-alt" :class="{'fa-spin': isFetchingModels}"></i> Обновить
          </button>
        </div>
        
        <AiSelect 
          v-model="activeProfile.settings.model" 
          :options="availableModels" 
          placeholder="Выберите модель или введите вручную"
          :allow-custom="true"
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
              <input type="checkbox" v-model="activeProfile.settings.enable_task_list">
              <span>Включить инструмент списка задач</span>
            </label>
            <span class="hint">При включении ИИ может создавать и управлять списками задач для отслеживания прогресса.</span>
          </div>
          
          <div class="form-group">
            <label>Уровень размышлений (Reasoning Effort)</label>
            <select v-model="activeProfile.settings.reasoning_effort" class="input-base">
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
            <input type="number" v-model.number="activeProfile.settings.timeout_mins" min="1" max="1440" class="input-base" placeholder="Например: 30">
            <span class="hint">Максимальное время, которое агент может работать в фоне, пока не будет прерван принудительно (по умолчанию 30 мин).</span>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="activeProfile.settings.use_custom_temperature">
              <span>Использовать пользовательскую температуру</span>
            </label>
            <span class="hint">Управляет случайностью ответов модели.</span>
          </div>

          <div class="form-group" v-if="activeProfile.settings.use_custom_temperature" style="margin-left: 24px;">
            <div style="display: flex; justify-content: space-between;">
              <label>Температура</label>
              <span>{{ activeProfile.settings.temperature ?? 1.0 }}</span>
            </div>
            <input type="range" v-model.number="activeProfile.settings.temperature" min="0" max="2" step="0.1" class="range-slider">
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label>Лимит скорости</label>
              <span>{{ activeProfile.settings.rate_limit_ms ?? 0 }}ms</span>
            </div>
            <input type="range" v-model.number="activeProfile.settings.rate_limit_ms" min="0" max="5000" step="100" class="range-slider">
            <span class="hint">Минимальное время между запросами к API.</span>
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label>Лимит ошибок и повторений</label>
              <span>{{ activeProfile.settings.error_retry_limit ?? 3 }}</span>
            </div>
            <input type="range" v-model.number="activeProfile.settings.error_retry_limit" min="0" max="10" step="1" class="range-slider">
            <span class="hint">Количество последовательных ошибок или повторных действий перед показом диалогового окна. Установите 0, чтобы отключить этот механизм.</span>
          </div>

          <div class="form-group">
            <label>Custom Instructions (Системный промпт)</label>
            <textarea v-model="activeProfile.settings.custom_instructions" class="input-base" rows="3" placeholder="Дополнительные инструкции для этого профиля..."></textarea>
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
  if (props.activeProfile) {
    props.activeProfile.settings.model = modelId;
  }
};
</script>

<style scoped>
.provider-tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
}

.range-slider {
  width: 100%;
  margin-top: 8px;
}
</style>
