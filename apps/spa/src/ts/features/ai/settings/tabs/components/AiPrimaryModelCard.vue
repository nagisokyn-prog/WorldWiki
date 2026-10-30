<template>
  <div class="config-card">
    <div class="card-header">
      <i class="fas fa-feather-alt text-primary"></i>
      <h4>Основная модель (Текст и Диалоги)</h4>
    </div>
    
    <div class="form-group">
      <label>Модель</label>
      <div class="flex gap-2">
        <div class="flex-1">
          <AiSelect
            :model-value="localSettings.model"
            :options="availableModelOptions"
            placeholder="Выберите или введите название модели"
            @update:model-value="$emit('update-setting', 'model', $event)"
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
            type="radio" 
            name="execution_policy"
            value="direct" 
            :checked="(localSettings.execution_policy || 'agentic') === 'direct'"
            @change="$emit('update-setting', 'execution_policy', 'direct')"
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
            type="radio" 
            name="execution_policy"
            value="tool_assisted" 
            :checked="localSettings.execution_policy === 'tool_assisted'"
            @change="$emit('update-setting', 'execution_policy', 'tool_assisted')"
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
            type="radio" 
            name="execution_policy"
            value="agentic" 
            :checked="localSettings.execution_policy === 'agentic'"
            @change="$emit('update-setting', 'execution_policy', 'agentic')"
          />
          <div class="policy-info">
            <span class="policy-title"><i class="fas fa-robot"></i> Автономный агент</span>
            <span class="policy-desc">Многошаговый цикл рассуждений для сложных писательских задач.</span>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiPrimaryModelCardProps, AiPrimaryModelCardEmits } from './AiPrimaryModelCard.model';
import { AiSelect } from '../../../components';

defineProps<AiPrimaryModelCardProps>();

defineEmits<AiPrimaryModelCardEmits>();
</script>
