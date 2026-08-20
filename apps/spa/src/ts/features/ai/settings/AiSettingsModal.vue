<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Настройки ИИ (AI Sandbox)</h2>
        <button class="close-btn" @click="$emit('close')"><i class="fas fa-times"></i></button>
      </div>
      
      <div class="modal-body">
        <div class="settings-sidebar">
          <button 
            :class="{ active: activeTab === 'providers' }" 
            @click="activeTab = 'providers'"
          >
            <i class="fas fa-server"></i> Провайдеры
          </button>
          <button 
            :class="{ active: activeTab === 'sandbox' }" 
            @click="activeTab = 'sandbox'"
          >
            <i class="fas fa-shield-alt"></i> Песочница (Sandbox)
          </button>
        </div>

        <div class="settings-content">
          <!-- ПРОВАЙДЕРЫ -->
          <div v-if="activeTab === 'providers'" class="tab-pane">
            <div class="form-group">
              <label>Выбор провайдера</label>
              <select v-model="selectedProvider" class="input-base">
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="gemini">Google Gemini</option>
                <option value="openrouter">OpenRouter</option>
                <option value="local">Локальная модель (llama-turboquant-cpp)</option>
              </select>
            </div>
            
            <div v-if="selectedProvider !== 'local'" class="form-group">
              <label>API Key</label>
              <input v-model="apiKey" type="password" class="input-base" placeholder="Введите ключ API">
            </div>

            <div class="form-group">
              <label>Модель</label>
              <input v-model="modelName" type="text" class="input-base" placeholder="Например: claude-3-7-sonnet-20250219">
            </div>
            
            <button class="btn-primary" @click="saveProvider">Сохранить провайдера</button>
          </div>

          <!-- ПЕСОЧНИЦА -->
          <div v-if="activeTab === 'sandbox'" class="tab-pane">
            <div class="sandbox-header">
              <h3>Разрешения и автоодобрение</h3>
              <div class="toggle-switch">
                <input id="global-sandbox" v-model="sandboxEnabled" type="checkbox">
                <label for="global-sandbox">Включить автоодобрение</label>
              </div>
            </div>

            <p class="text-muted" style="font-size: 13px; margin-bottom: 20px;">
              Укажите, какие действия ИИ может выполнять без вашего ручного подтверждения.
            </p>

            <div class="form-group">
              <label>Пресеты разрешений</label>
              <select v-model="preset" class="input-base" :disabled="!sandboxEnabled" @change="applyPreset">
                <option value="safe">Безопасный (Только чтение и аналитика)</option>
                <option value="balanced">Сбалансированный (Чтение + создание, без удаления)</option>
                <option value="expert">Экспертный (Все действия, кроме удаления)</option>
                <option value="custom">Пользовательский</option>
              </select>
            </div>

            <div class="categories-grid" :class="{ disabled: !sandboxEnabled }">
              <label class="checkbox-label">
                <input v-model="categories.read" type="checkbox">
                <span>Чтение данных (поиск, граф, главы)</span>
              </label>
              <label class="checkbox-label">
                <input v-model="categories.analyze" type="checkbox">
                <span>Аналитика (противоречия, отчёты)</span>
              </label>
              <label class="checkbox-label">
                <input v-model="categories.edit_entities" type="checkbox">
                <span>Изменение сущностей</span>
              </label>
              <label class="checkbox-label">
                <input v-model="categories.edit_relations" type="checkbox">
                <span>Изменение связей</span>
              </label>
              <label class="checkbox-label">
                <input v-model="categories.edit_content" type="checkbox">
                <span>Изменение контента (текст глав)</span>
              </label>
            </div>

            <hr class="divider">

            <h4>Точечный контроль (Granular)</h4>
            
            <div class="form-group">
              <label>Denylist (Типы сущностей)</label>
              <input v-model="denylistText" type="text" class="input-base" placeholder="Например: organization, state" :disabled="!sandboxEnabled">
              <span class="hint">Изменение этих типов ВСЕГДА будет требовать одобрения.</span>
            </div>

            <div class="form-group">
              <label>Allowlist (Типы сущностей)</label>
              <input v-model="allowlistText" type="text" class="input-base" placeholder="Например: character, location" :disabled="!sandboxEnabled">
              <span class="hint">Разрешает изменение этих типов даже при выключенной категории (если не в Denylist).</span>
            </div>
            
            <div class="sandbox-header" style="margin-top: 15px;">
              <div class="toggle-switch">
                <input id="is-global-setting" v-model="isGlobal" type="checkbox">
                <label for="is-global-setting">Применить для всех проектов</label>
              </div>
            </div>

            <button class="btn-primary" style="margin-top: 20px;" @click="saveSandbox">Сохранить песочницу</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

withDefaults(defineProps<{
  isOpen?: boolean;
}>(), {
  isOpen: false
});

defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref('providers');

// Provider state
const selectedProvider = ref('anthropic');
const apiKey = ref('');
const modelName = ref('claude-3-7-sonnet-20250219');

// Sandbox state
const sandboxEnabled = ref(false);
const preset = ref('safe');
const isGlobal = ref(false);

const categories = ref({
  read: true,
  analyze: true,
  edit_entities: false,
  edit_relations: false,
  edit_content: false
});

const allowlistText = ref('');
const denylistText = ref('');

const applyPreset = () => {
  if (preset.value === 'safe') {
    categories.value = { read: true, analyze: true, edit_entities: false, edit_relations: false, edit_content: false };
  } else if (preset.value === 'balanced') {
    categories.value = { read: true, analyze: true, edit_entities: true, edit_relations: true, edit_content: false };
  } else if (preset.value === 'expert') {
    categories.value = { read: true, analyze: true, edit_entities: true, edit_relations: true, edit_content: true };
  }
};

watch(categories, () => {
  // If user manually changes a checkbox, switch preset to custom
  preset.value = 'custom';
}, { deep: true });

const saveProvider = async () => {
  const { appAlert } = await import('@worldwiki/components');
  appAlert('Настройки провайдера сохранены.');
};

const saveSandbox = async () => {
  const { appAlert } = await import('@worldwiki/components');
  appAlert('Настройки песочницы сохранены.');
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsModal.css"></style>
