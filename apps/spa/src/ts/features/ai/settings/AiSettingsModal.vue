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

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

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

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--bg-panel);
  width: 800px;
  max-width: 95vw;
  height: 600px;
  max-height: 90vh;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-main);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 18px;
}

.close-btn:hover {
  color: var(--danger);
}

.modal-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.settings-sidebar {
  width: 220px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-main);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-sidebar button {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 10px 14px;
  text-align: left;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  transition: all 0.2s;
}

.settings-sidebar button:hover {
  background: var(--bg-surface);
  color: var(--text-main);
}

.settings-sidebar button.active {
  background: rgba(139, 92, 246, 0.15);
  color: var(--accent);
  font-weight: 500;
}

.settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.3s ease;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
}

.input-base {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
}

.input-base:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-primary {
  background: var(--accent);
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  align-self: flex-start;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.sandbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.categories-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.categories-grid.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.divider {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 16px 0;
}

.hint {
  font-size: 11px;
  color: var(--text-muted);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
