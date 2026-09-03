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
import { 
  useAiSettingsConnectionsTab, 
  type AiSettingsConnectionsTabProps, 
  type AiSettingsConnectionsTabEmits 
} from './useAiSettingsConnectionsTab';

const props = defineProps<AiSettingsConnectionsTabProps>();
const emit = defineEmits<AiSettingsConnectionsTabEmits>();

const {
  showApiKey,
  localProfile,
  handleSave,
  getProviderLabel,
  getDefaultUrl
} = useAiSettingsConnectionsTab(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsConnectionsTab.css"></style>
