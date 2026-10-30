<template>
  <div class="config-card">
    <div class="card-header">
      <i class="fas fa-brain text-accent"></i>
      <h4>Поиск по лору и База знаний (Auto-RAG)</h4>
    </div>

    <div class="form-group">
      <label>Модель эмбеддингов для лора</label>
      <select 
        :value="localSettings.embed_model_path || ''"
        class="input-base"
        @change="$emit('update-setting', 'embed_model_path', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">-- Выберите модель эмбеддингов --</option>
        <optgroup v-if="installedModels && installedModels.length > 0" label="Скачанные локальные модели (GGUF)">
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

      <input 
        v-if="isCustomEmbedPath" 
        :value="customEmbedInput" 
        type="text" 
        class="input-base mt-1" 
        placeholder="Путь к локальному .gguf или имя модели в API" 
        @input="$emit('custom-embed-input', ($event.target as HTMLInputElement).value)" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiRagConfigCardProps, AiRagConfigCardEmits } from './AiRagConfigCard.model';

defineProps<AiRagConfigCardProps>();

defineEmits<AiRagConfigCardEmits>();
</script>
