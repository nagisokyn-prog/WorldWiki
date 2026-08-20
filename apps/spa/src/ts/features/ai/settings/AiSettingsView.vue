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
          :class="{ active: activeTab === 'modes' }"
          @click="activeTab = 'modes'"
        >
          <i class="fas fa-theater-masks"></i> Режимы
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
          activeTab === 'modes' ? 'Режимы Агента' :
          activeTab === 'auto_approval' ? 'Правила песочницы' : 'Специфичные правила' 
        }}</h2>
        <button class="btn-secondary-outline" title="Закрыть настройки" style="padding: 6px 12px;" @click="$emit('close')">
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
                <button class="btn-secondary-outline" title="Создать новый профиль" @click="createNewProfile">
                  <i class="fas fa-plus"></i>
                </button>
                <button 
                  v-if="profiles.length > 1" 
                  class="btn-danger-outline" 
                  title="Удалить профиль" 
                  @click="deleteActiveProfile"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <AiSettingsProviderTab 
              :active-profile="activeProfile"
              :available-models="availableModels"
              :is-fetching-models="isFetchingModels"
              :fetch-error="fetchError"
              @fetch-models="handleFetchModels"
              @save-profile="saveActiveProfile"
              @provider-changed="handleProviderChange"
            />
          </div>
        </div>

        <AiSettingsModesTab 
          v-if="activeTab === 'modes'" 
          :current-project="currentProject"
        />

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
import AiSettingsModesTab from '../components/settings/AiSettingsModesTab.vue';
import AiSettingsSandboxTab from '../components/settings/AiSettingsSandboxTab.vue';
import AiSettingsRulesTab from '../components/settings/AiSettingsRulesTab.vue';
import { useAiProfiles } from '../composables/useAiProfiles';
import { useAiModels } from '../composables/useAiModels';

defineEmits(['close']);

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

const saveSandbox = async () => {
  // Mocked for now, integrate with original sandbox save logic later
  const { appAlert } = await import('@worldwiki/components');
  appAlert('Сохранено (заглушка)');
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsView.css"></style>
