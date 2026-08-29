<template>
  <div class="connections-tab">
    <div class="tab-intro">
      <h3>Подключения и API-ключи</h3>
      <p class="text-muted">
        Укажите ключи доступа к облачным провайдерам или адрес локального сервера. Настройки применяются ко всем моделям данного провайдера.
      </p>
    </div>

    <div class="profiles-manager">
      <div class="profiles-list-header">
        <label class="form-label">Активное подключение</label>
        <div class="profile-actions">
          <select 
            :value="localProfile?.id" 
            class="input-base profile-select" 
            @change="$emit('select-profile', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="p in profiles" :key="p.id" :value="p.id">
              {{ p.name }} ({{ getProviderLabel(p.provider) }})
            </option>
          </select>
          <button class="btn-secondary-outline" title="Создать новое подключение" @click="$emit('create-profile')">
            <i class="fas fa-plus"></i> Создать
          </button>
          <button 
            v-if="profiles.length > 1" 
            class="btn-danger-outline" 
            title="Удалить текущее подключение" 
            @click="$emit('delete-profile')"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <div v-if="localProfile" class="connection-form">
      <div class="form-group">
        <label>Название подключения</label>
        <input 
          v-model="localProfile.name" 
          type="text" 
          class="input-base" 
          placeholder="Например: Мой OpenRouter или Локальный сервер" 
        />
      </div>

      <div class="form-group">
        <label>Провайдер</label>
        <select 
          v-model="localProfile.provider" 
          class="input-base" 
          @change="$emit('provider-changed', localProfile.provider)"
        >
          <option value="openrouter">OpenRouter (Все современные нейросети)</option>
          <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku / Opus)</option>
          <option value="openai">OpenAI (ChatGPT, GPT-4o, o1, o3)</option>
          <option value="gemini">Google Gemini (Gemini 1.5 / 2.0 Flash / Pro)</option>
          <option value="deepseek">DeepSeek (V3, R1 Рассуждения)</option>
          <option value="local">Локальный движок (llama.cpp / Встроенный инференс)</option>
          <option value="ollama">Ollama (Внешний локальный сервер)</option>
        </select>
      </div>

      <div v-if="localProfile.provider !== 'local'" class="form-group">
        <label>API-ключ</label>
        <div class="api-key-wrapper">
          <input 
            v-model="localProfile.api_key" 
            :type="showApiKey ? 'text' : 'password'" 
            class="input-base" 
            placeholder="sk-..." 
          />
          <button 
            type="button" 
            class="btn-eye" 
            :title="showApiKey ? 'Скрыть ключ' : 'Показать ключ'" 
            @click="showApiKey = !showApiKey"
          >
            <i :class="showApiKey ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
          </button>
        </div>
        <span class="field-hint">Ключ хранится локально на вашем компьютере в зашифрованной базе.</span>
      </div>

      <div class="form-group">
        <label>Адрес сервера (URL эндпоинта)</label>
        <input 
          v-model="localProfile.base_url" 
          type="text" 
          class="input-base" 
          :placeholder="getDefaultUrl(localProfile.provider)" 
        />
        <span class="field-hint">Оставьте пустым для использования стандартного официального адреса API.</span>
      </div>

      <div class="form-actions mt-6">
        <button class="btn-primary" @click="handleSave">
          <i class="fas fa-check"></i> Сохранить подключение
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AiProfile } from '../../types/ai.types';

const props = defineProps<{
  profiles: AiProfile[];
  activeProfile: AiProfile | null;
}>();

const emit = defineEmits(['select-profile', 'create-profile', 'delete-profile', 'save-profile', 'provider-changed']);

const showApiKey = ref(false);
const localProfile = ref<AiProfile | null>(null);

watch(() => props.activeProfile, (newVal) => {
  if (newVal) {
    localProfile.value = { ...newVal };
  } else {
    localProfile.value = null;
  }
}, { immediate: true, deep: true });

const handleSave = () => {
  emit('save-profile', localProfile.value);
};

const getProviderLabel = (provider: string) => {
  const map: Record<string, string> = {
    openrouter: 'OpenRouter',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    deepseek: 'DeepSeek',
    local: 'Локальный инференс',
    ollama: 'Ollama',
  };
  return map[provider] || provider;
};

const getDefaultUrl = (provider: string) => {
  const map: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1',
    anthropic: 'https://api.anthropic.com',
    openai: 'https://api.openai.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
    deepseek: 'https://api.deepseek.com/v1',
    local: 'http://localhost:8080/v1',
    ollama: 'http://localhost:11434/v1',
  };
  return map[provider] || 'https://api.openai.com/v1';
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsConnectionsTab.css"></style>
