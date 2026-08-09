<template>
  <div class="ai-settings-view">
    <div class="settings-header">
      <button class="back-btn" @click="$emit('close')">
        <i class="fas fa-arrow-left"></i> Назад в чат
      </button>
      <h2>Настройки ИИ</h2>
    </div>
    
    <div class="settings-body">
      <div class="settings-sidebar">
        <button 
          :class="{ active: activeTab === 'providers' }" 
          @click="activeTab = 'providers'"
        >
          <i class="fas fa-server"></i> Провайдеры
        </button>
        <button 
          :class="{ active: activeTab === 'auto_approval' }" 
          @click="activeTab = 'auto_approval'"
        >
          <i class="fas fa-shield-check"></i> Автоодобрение
        </button>
        <button 
          :class="{ active: activeTab === 'custom_rules' }" 
          @click="activeTab = 'custom_rules'"
        >
          <i class="fas fa-sliders-h"></i> Кастомные правила
        </button>
      </div>

      <div class="settings-content">
        <!-- ПРОВАЙДЕРЫ -->
        <div v-if="activeTab === 'providers'" class="tab-pane">
          <div class="form-group profile-header" style="margin-bottom: 16px;">
            <label>Профиль ИИ (Конфигурация)</label>
            <div style="display: flex; gap: 8px;">
              <select v-model="activeProfileId" class="input-base" style="flex: 1;" @change="handleProfileChange">
                <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <button class="btn-secondary-outline" @click="createNewProfile" title="Создать новый профиль">
                <i class="fas fa-plus"></i>
              </button>
              <button v-if="profiles.length > 1" class="btn-danger-outline" @click="deleteActiveProfile" title="Удалить профиль">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <div v-if="activeProfile" class="profile-editor">
            <div class="form-group">
              <label>Имя профиля</label>
              <input type="text" v-model="activeProfile.name" class="input-base">
            </div>

            <div class="form-group">
              <label>Выбор провайдера</label>
              <AiSelect 
                v-model="activeProfile.provider" 
                :options="providerOptions" 
                placeholder="Выберите провайдера"
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
                <button class="back-btn" @click="forceFetchModels" style="font-size: 11px;">
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
            </div>

            <div class="form-group">
              <label>Custom Instructions (Системный промпт)</label>
              <textarea v-model="activeProfile.settings.custom_instructions" class="input-base" rows="3" placeholder="Дополнительные инструкции для этого профиля..."></textarea>
            </div>

            <!-- Advanced Settings Accordion -->
            <div class="advanced-settings-accordion">
              <button class="accordion-trigger" @click="isAdvancedOpen = !isAdvancedOpen">
                <i class="fas" :class="isAdvancedOpen ? 'fa-chevron-down' : 'fa-chevron-right'"></i> 
                Продвинутые настройки
              </button>
              <div v-if="isAdvancedOpen" class="accordion-content">
                <div class="form-group">
                  <label>Temperature: {{ activeProfile.settings.temperature ?? 1.0 }}</label>
                  <input type="range" v-model.number="activeProfile.settings.temperature" min="0" max="2" step="0.1" class="range-slider">
                </div>
                <div class="form-group">
                  <label>Context Window Size</label>
                  <input type="number" v-model.number="activeProfile.settings.context_window" class="input-base" placeholder="Например: 128000">
                </div>
                <div class="form-group">
                  <label>Max Tokens</label>
                  <input type="number" v-model.number="activeProfile.settings.max_tokens" class="input-base" placeholder="Например: 4096">
                </div>
                <div class="form-group">
                  <label>Thinking Budget (для reasoning моделей)</label>
                  <input type="number" v-model.number="activeProfile.settings.thinking_budget" class="input-base" placeholder="Например: 1024">
                </div>
              </div>
            </div>
            
            <button class="btn-primary" style="margin-top: 15px;" @click="saveActiveProfile">Сохранить профиль</button>
          </div>
        </div>

        <!-- АВТООДОБРЕНИЕ -->
        <div v-if="activeTab === 'auto_approval'" class="tab-pane">
          <div class="sandbox-header">
            <h3>Разрешения и автоодобрение</h3>
            <div class="toggle-switch">
              <input type="checkbox" id="global-sandbox" v-model="sandboxEnabled">
              <label for="global-sandbox">Включить автоодобрение</label>
            </div>
          </div>

          <p class="text-muted" style="font-size: 13px; margin-bottom: 20px;">
            Укажите, какие действия ИИ может выполнять без вашего ручного подтверждения.
          </p>

          <div class="form-group">
            <label>Пресеты разрешений</label>
            <select v-model="preset" class="input-base" @change="applyPreset" :disabled="!sandboxEnabled">
              <option value="safe">Безопасный (Только чтение и аналитика)</option>
              <option value="balanced">Сбалансированный (Чтение + создание, без удаления)</option>
              <option value="expert">Экспертный (Все действия, кроме удаления)</option>
              <option value="custom">Пользовательский</option>
            </select>
          </div>

          <div class="categories-grid" :class="{ disabled: !sandboxEnabled }">
            <label class="checkbox-label">
              <input type="checkbox" v-model="categories.read">
              <span>Чтение данных (поиск, граф, главы)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="categories.analyze">
              <span>Аналитика (противоречия, отчёты)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="categories.edit_entities">
              <span>Изменение сущностей</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="categories.edit_relations">
              <span>Изменение связей</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="categories.edit_content">
              <span>Изменение контента (текст глав)</span>
            </label>
          </div>
          
          <button class="btn-primary" @click="saveSandbox" style="margin-top: 20px;">Сохранить разрешения</button>
        </div>

        <!-- КАСТОМНЫЕ ПРАВИЛА (Allowlist / Denylist) -->
        <div v-if="activeTab === 'custom_rules'" class="tab-pane">
          <div class="sandbox-header">
            <h3>Точечный контроль (Granular)</h3>
            <div class="toggle-switch">
              <input type="checkbox" id="is-global-setting" v-model="isGlobal">
              <label for="is-global-setting">Применить для всех проектов</label>
            </div>
          </div>

          <p class="text-muted" style="font-size: 13px; margin-bottom: 20px;">
            Переопределение правил автоодобрения для конкретных типов сущностей.
          </p>
          
          <div class="form-group">
            <label>Denylist (Чёрный список)</label>
            <input type="text" v-model="denylistText" class="input-base" placeholder="Например: organization, state">
            <span class="hint">Изменение этих типов ВСЕГДА будет требовать одобрения.</span>
          </div>

          <div class="form-group">
            <label>Allowlist (Белый список)</label>
            <input type="text" v-model="allowlistText" class="input-base" placeholder="Например: character, location">
            <span class="hint">Разрешает изменение этих типов даже при выключенной категории (если не в Denylist).</span>
          </div>
          
          <button class="btn-primary" @click="saveSandbox" style="margin-top: 20px;">Сохранить правила</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import AiSelect from '../components/AiSelect.vue';
import { invoke } from '@tauri-apps/api/core';

const emit = defineEmits(['close']);

const urlParams = new URLSearchParams(window.location.search);
const currentProject = urlParams.get('project') || 'global';

const activeTab = ref('providers');
const isAdvancedOpen = ref(false);

// Models Cache & Hardcode Fallbacks
const hardcodedModels: Record<string, {value: string, label: string, description: string}[]> = {
  'anthropic': [
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', description: 'Улучшенный reasoning' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Отлично подходит для кода' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', description: 'Мощная модель' }
  ],
  'openai': [
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Флагманская модель OpenAI' },
    { value: 'o3-mini', label: 'o3-mini', description: 'Быстрый reasoning' }
  ],
  'gemini': [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Сложные задачи и код' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Быстрая модель' }
  ],
  'openrouter': []
};

// Provider Options
const providerOptions = [
  { value: 'anthropic', label: 'Anthropic (Claude)', description: 'Официальный API Anthropic' },
  { value: 'openai', label: 'OpenAI (GPT)', description: 'Официальный API OpenAI' },
  { value: 'gemini', label: 'Google Gemini', description: 'Официальный API Google' },
  { value: 'openrouter', label: 'OpenRouter', description: 'Агрегатор 100+ моделей' },
  { value: 'local', label: 'Локальная / OpenAI Compatible', description: 'Ollama, LM Studio, vLLM' },
];

const availableModels = ref<{value: string, label: string, description: string}[]>([]);
const isFetchingModels = ref(false);
const fetchError = ref('');

// AiProfile Schema
interface AiProfile {
  id?: string;
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  settings: {
    model: string;
    temperature: number;
    max_tokens?: number;
    context_window?: number;
    thinking_budget?: number;
    custom_instructions?: string;
  };
  is_active: boolean;
  is_global: boolean;
}

const profiles = ref<AiProfile[]>([]);
const activeProfileId = ref<string>('');

const activeProfile = computed(() => {
  return profiles.value.find(p => p.id === activeProfileId.value) || null;
});

const loadProfiles = async () => {
  try {
    const data: AiProfile[] = await invoke('get_ai_profiles', { project: currentProject });
    
    if (data && data.length > 0) {
      profiles.value = data;
      const active = data.find(p => p.is_active);
      activeProfileId.value = active ? active.id! : data[0].id!;
    } else {
      // Create default profile
      const newProfile: AiProfile = {
        name: 'Default Profile',
        provider: 'anthropic',
        base_url: '',
        api_key: '',
        settings: { model: 'claude-3-7-sonnet-20250219', temperature: 1.0 },
        is_active: true,
        is_global: false
      };
      const created: AiProfile = await invoke('create_ai_profile', { project: currentProject, payload: newProfile });
      profiles.value = [created];
      activeProfileId.value = created.id!;
    }
  } catch (err) {
    console.error('Failed to load profiles:', err);
  }
};

onMounted(() => {
  loadProfiles();
});

const createNewProfile = async () => {
  const newProfile: AiProfile = {
    name: `New Profile ${profiles.value.length + 1}`,
    provider: 'anthropic',
    base_url: '',
    api_key: '',
    settings: { model: 'claude-3-5-sonnet-20241022', temperature: 1.0 },
    is_active: false,
    is_global: false
  };
  try {
    const created: AiProfile = await invoke('create_ai_profile', { project: currentProject, payload: newProfile });
    profiles.value.push(created);
    activeProfileId.value = created.id!;
  } catch (err) {
    console.error('Failed to create profile:', err);
  }
};

const deleteActiveProfile = async () => {
  if (profiles.value.length <= 1) return;
  const idToDelete = activeProfileId.value;
  try {
    await invoke('delete_ai_profile', { project: currentProject, id: idToDelete });
    profiles.value = profiles.value.filter(p => p.id !== idToDelete);
    activeProfileId.value = profiles.value[0].id!;
  } catch (err) {
    console.error('Failed to delete profile:', err);
  }
};

const saveActiveProfile = async () => {
  if (!activeProfile.value || !activeProfile.value.id) return;
  try {
    // Set this profile as active, others inactive
    activeProfile.value.is_active = true;
    for (const p of profiles.value) {
      if (p.id !== activeProfile.value.id && p.is_active) {
        p.is_active = false;
        await invoke('update_ai_profile', { project: currentProject, id: p.id, payload: p });
      }
    }
    await invoke('update_ai_profile', { project: currentProject, id: activeProfile.value.id, payload: activeProfile.value });
    alert('Профиль сохранен!');
  } catch (err) {
    console.error('Failed to save profile:', err);
    alert('Ошибка при сохранении профиля');
  }
};

const handleProfileChange = () => {
  fetchModelsForActive();
};

const getCacheKey = (provider: string) => `ai_models_cache_${provider}`;

const fetchModelsForActive = async (forceNetwork = false) => {
  if (!activeProfile.value) return;
  const p = activeProfile.value.provider;
  const key = activeProfile.value.api_key;
  
  fetchError.value = '';

  // 1. Load from cache or hardcode immediately for UX
  const cached = localStorage.getItem(getCacheKey(p));
  if (cached) {
    try {
      availableModels.value = JSON.parse(cached);
    } catch(e) {}
  } else if (hardcodedModels[p]) {
    availableModels.value = hardcodedModels[p];
  } else {
    availableModels.value = [];
  }

  // 2. Fetch in background (or foreground if forced)
  if (p === 'local' && !activeProfile.value.base_url) return; // Need url for local
  
  if (forceNetwork) isFetchingModels.value = true;
  
  try {
    const res: any[] = await invoke('fetch_ai_models', { 
      provider: p, 
      apiKey: key || ''
    });
    
    if (res && res.length > 0) {
      availableModels.value = res;
      localStorage.setItem(getCacheKey(p), JSON.stringify(res));
      
      // Auto-select if model empty
      if (!activeProfile.value.settings.model) {
        activeProfile.value.settings.model = res[0].value;
      }
    }
  } catch (err: any) {
    console.warn('Background fetch models failed:', err);
    if (forceNetwork) {
      fetchError.value = err.toString();
    }
  } finally {
    if (forceNetwork) isFetchingModels.value = false;
  }
};

const forceFetchModels = () => fetchModelsForActive(true);

// Watch for provider changes to trigger fetch
watch(() => activeProfile.value?.provider, (newProvider, oldProvider) => {
  if (newProvider && newProvider !== oldProvider) {
    fetchModelsForActive(false);
  }
});


// Sandbox state (legacy for now)
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
  preset.value = 'custom';
}, { deep: true });

const saveSandbox = () => {
  alert('Настройки песочницы сохранены.');
};
</script>

<style scoped>
.ai-settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
  animation: fadeIn 0.2s ease;
}

.settings-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-btn:hover {
  color: var(--accent);
}

.settings-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.settings-body {
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
  overflow-y: auto;
}

/* Custom Scrollbar */
.settings-sidebar::-webkit-scrollbar,
.settings-content::-webkit-scrollbar {
  width: 6px;
}
.settings-sidebar::-webkit-scrollbar-track,
.settings-content::-webkit-scrollbar-track {
  background: transparent;
}
.settings-sidebar::-webkit-scrollbar-thumb,
.settings-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}
.settings-sidebar::-webkit-scrollbar-thumb:hover,
.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
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
  max-width: 600px;
  animation: fadeIn 0.3s ease;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
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
  width: 100%;
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

.btn-secondary-outline, .btn-danger-outline {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.2s;
}
.btn-secondary-outline:hover {
  border-color: var(--text-main);
}
.btn-danger-outline {
  color: var(--error);
  border-color: var(--error);
}
.btn-danger-outline:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Accordion */
.advanced-settings-accordion {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
}

.accordion-trigger {
  width: 100%;
  background: var(--bg-surface);
  border: none;
  padding: 12px 16px;
  text-align: left;
  color: var(--text-main);
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
}

.accordion-content {
  padding: 16px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-color);
}

.range-slider {
  width: 100%;
  accent-color: var(--accent);
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
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
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
