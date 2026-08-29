<template>
  <div class="ai-settings-view">
    <div class="settings-sidebar">
      <div class="settings-header">
        <h2>Центр управления AI</h2>
      </div>

      <div class="settings-nav">
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'connections' }"
          @click="activeTab = 'connections'"
        >
          <i class="fas fa-plug"></i> Подключения
        </button>
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'models' }"
          @click="activeTab = 'models'"
        >
          <i class="fas fa-brain"></i> Модели и логика
        </button>
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'local_ai' }"
          @click="activeTab = 'local_ai'"
        >
          <i class="fas fa-microchip"></i> Локальный ИИ
        </button>
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'modes' }"
          @click="activeTab = 'modes'"
        >
          <i class="fas fa-theater-masks"></i> Режимы и роли
        </button>
        <button 
          class="nav-item" 
          :class="{ active: activeTab === 'permissions' }"
          @click="activeTab = 'permissions'"
        >
          <i class="fas fa-shield-alt"></i> Права доступа
        </button>
      </div>
    </div>

    <div class="settings-content">
      <div class="tab-header">
        <h2>{{ tabTitles[activeTab] || 'Настройки' }}</h2>
        <button class="btn-secondary-outline btn-close-settings" title="Закрыть настройки" @click="$emit('close')">
          <i class="fas fa-times"></i> Закрыть
        </button>
      </div>

      <div class="tab-body">
        <div v-if="isLoading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i> Загрузка настроек...
        </div>

        <template v-else>
          <!-- 1. ПОДКЛЮЧЕНИЯ (CONNECTIONS) -->
          <AiSettingsConnectionsTab 
            v-if="activeTab === 'connections'"
            :profiles="profiles"
            :active-profile="activeProfile"
            @select-profile="handleProfileSelect"
            @create-profile="createNewProfile"
            @delete-profile="deleteActiveProfile"
            @save-profile="handleSaveProfile"
            @provider-changed="handleProviderChange"
          />

          <!-- 2. МОДЕЛИ (MODELS) -->
          <AiSettingsModelsTab 
            v-if="activeTab === 'models'"
            :active-profile="activeProfile"
            :available-models="availableModels"
            :is-fetching-models="isFetchingModels"
            :fetch-error="fetchError"
            @save-profile="handleSaveProfile"
            @fetch-models="handleFetchModels"
          />

          <!-- 3. ЛОКАЛЬНЫЙ ИИ (LOCAL AI HUB) -->
          <AiSettingsLocalTab 
            v-if="activeTab === 'local_ai'"
            :active-profile="activeProfile"
            @save-profile="handleSaveProfile"
          />

          <!-- 4. РЕЖИМЫ (MODES) -->
          <AiSettingsModesTab 
            v-if="activeTab === 'modes'"
            :current-project="currentProject"
          />

          <!-- 5. ПРАВА ДОСТУПА (PERMISSIONS) -->
          <AiSettingsPermissionsTab 
            v-if="activeTab === 'permissions'"
            @save-permissions="handleSavePermissions"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { AiProfile } from '../types/ai.types';
import AiSettingsConnectionsTab from './tabs/AiSettingsConnectionsTab.vue';
import AiSettingsModelsTab from './tabs/AiSettingsModelsTab.vue';
import AiSettingsLocalTab from './tabs/AiSettingsLocalTab.vue';
import AiSettingsModesTab from './tabs/AiSettingsModesTab.vue';
import AiSettingsPermissionsTab from './tabs/AiSettingsPermissionsTab.vue';

import { useAiProfiles } from '../composables/useAiProfiles';
import { useAiModels } from '../composables/useAiModels';

defineEmits(['close']);

type TabType = 'connections' | 'models' | 'local_ai' | 'modes' | 'permissions';
const savedTab = localStorage.getItem('worldwiki_ai_settings_active_tab') as TabType;
const activeTab = ref<TabType>(savedTab && ['connections', 'models', 'local_ai', 'modes', 'permissions'].includes(savedTab) ? savedTab : 'connections');

watch(activeTab, (val) => {
  localStorage.setItem('worldwiki_ai_settings_active_tab', val);
});

const tabTitles: Record<string, string> = {
  connections: 'Подключения и API-ключи',
  models: 'Модели и логика генерации',
  local_ai: 'Центр локальных моделей',
  modes: 'Режимы и роли ИИ-помощника',
  permissions: 'Инструменты и безопасность',
};

// Project ID
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

const handleProfileSelect = (id: string) => {
  activeProfileId.value = id;
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

const handleSaveProfile = async (updatedData?: Partial<AiProfile>) => {
  if (updatedData && activeProfile.value) {
    if (updatedData.settings && activeProfile.value.settings) {
      Object.assign(activeProfile.value.settings, updatedData.settings);
    }
    Object.assign(activeProfile.value, updatedData);
  }
  await saveActiveProfile();
};

const handleSavePermissions = async () => {
  const { appAlert } = await import('@worldwiki/components');
  appAlert('Права доступа успешно сохранены');
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsView.css"></style>
