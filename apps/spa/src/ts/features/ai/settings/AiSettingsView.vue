<template>
  <div class="ai-settings-view">
    <div class="settings-sidebar">
      <div class="settings-header">
        <h2>Настройки AI</h2>
      </div>

      <div class="settings-nav">
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'providers' }"
          @click="activeTab = 'providers'"
        >
          <i class="fas fa-server"></i> Провайдеры
        </button>
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'auto_approval' }"
          @click="activeTab = 'auto_approval'"
        >
          <i class="fas fa-shield-alt"></i> Автоодобрение
        </button>
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'custom_rules' }"
          @click="activeTab = 'custom_rules'"
        >
          <i class="fas fa-sliders-h"></i> Точечный контроль
        </button>
      </div>
    </div>

    <div class="settings-content">
      <div class="tab-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2>{{ 
          activeTab === 'providers' ? 'Провайдеры и модели' : 
          activeTab === 'auto_approval' ? 'Правила песочницы' : 'Специфичные правила' 
        }}</h2>
        <button class="btn-secondary-outline" @click="$emit('close')" title="Закрыть настройки" style="padding: 6px 12px;">
          <i class="fas fa-times"></i> Закрыть
        </button>
      </div>

      <div class="tab-body">
        
        <div v-if="activeTab === 'providers'" class="tab-pane">
          <div v-if="isLoading" class="loading-state">
            Загрузка профилей...
          </div>
          <div v-else class="profiles-section">
            <div class="profiles-header">
              <h3>Профили</h3>
              <div style="display: flex; gap: 8px;">
                <select v-model="activeProfileId" class="input-base" style="flex: 1;" @change="handleProfileChange">
                  <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <button class="btn-secondary-outline" @click="createNewProfile" title="Создать новый профиль">
                  <i class="fas fa-plus"></i>
                </button>
                <button 
                  v-if="profiles.length > 1" 
                  class="btn-danger-outline" 
                  @click="deleteActiveProfile" 
                  title="Удалить профиль"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <AiSettingsProviderTab 
              :activeProfile="activeProfile"
              :availableModels="availableModels"
              :isFetchingModels="isFetchingModels"
              :fetchError="fetchError"
              @fetch-models="handleFetchModels"
              @save-profile="saveActiveProfile"
              @provider-changed="handleProviderChange"
            />
          </div>
        </div>

        <AiSettingsSandboxTab 
          v-if="activeTab === 'auto_approval'" 
          @save-sandbox="saveSandbox" 
        />
        
        <AiSettingsRulesTab 
          v-if="activeTab === 'custom_rules'" 
          @save-rules="saveSandbox" 
        />
        
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AiSettingsProviderTab from '../components/settings/AiSettingsProviderTab.vue';
import AiSettingsSandboxTab from '../components/settings/AiSettingsSandboxTab.vue';
import AiSettingsRulesTab from '../components/settings/AiSettingsRulesTab.vue';
import { useAiProfiles } from '../composables/useAiProfiles';
import { useAiModels } from '../composables/useAiModels';

const emit = defineEmits(['close']);

const activeTab = ref('providers');

// Get project ID
let currentProject = 'global';
const hash = window.location.hash;
if (hash.includes('?')) {
  const hashParams = new URLSearchParams(hash.split('?')[1]);
  const p = hashParams.get('project');
  if (p) currentProject = p.includes(':') ? p : `projects:${p}`;
} else {
  const searchParams = new URLSearchParams(window.location.search);
  const p = searchParams.get('project');
  if (p) currentProject = p.includes(':') ? p : `projects:${p}`;
}

const { 
  profiles, 
  activeProfileId, 
  activeProfile, 
  isLoading, 
  loadProfiles, 
  createNewProfile, 
  deleteActiveProfile, 
  saveActiveProfile 
} = useAiProfiles(currentProject);

const { availableModels, isFetchingModels, fetchError, fetchModels } = useAiModels();

onMounted(async () => {
  await loadProfiles();
  handleFetchModels();
});

const handleProfileChange = () => {
  handleFetchModels();
};

const handleProviderChange = () => {
  handleFetchModels();
};

const handleFetchModels = async (forceNetwork = false) => {
  if (activeProfile.value) {
    await fetchModels(
      activeProfile.value.provider, 
      activeProfile.value.api_key, 
      activeProfile.value.base_url, 
      forceNetwork
    );
  }
};

const saveSandbox = () => {
  // Mocked for now, integrate with original sandbox save logic later
  alert('Сохранено (заглушка)');
};
</script>

<style scoped>
.ai-settings-view {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: var(--bg-surface);
  color: var(--text-main);
}

.settings-sidebar {
  width: 250px;
  background: var(--bg-surface-alt);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.settings-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.settings-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.settings-nav {
  padding: 10px 0;
  display: flex;
  flex-direction: column;
}

.nav-item {
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
}

.nav-item:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-main);
}

.nav-item.active {
  background: var(--bg-surface);
  color: var(--accent);
  border-left: 3px solid var(--accent);
}

.nav-item i {
  width: 16px;
  text-align: center;
}

.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
}

.tab-header {
  padding: 20px 30px;
  border-bottom: 1px solid var(--border-color);
}

.tab-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.tab-body {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.tab-pane {
  max-width: 600px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.profiles-section {
  background: var(--bg-surface-alt);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 25px;
}

.profiles-header {
  margin-bottom: 20px;
}

.profiles-header h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: var(--text-muted);
}
</style>
