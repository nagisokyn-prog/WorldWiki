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
import AiSettingsConnectionsTab from './tabs/AiSettingsConnectionsTab.vue';
import AiSettingsModelsTab from './tabs/AiSettingsModelsTab.vue';
import AiSettingsLocalTab from './tabs/AiSettingsLocalTab.vue';
import AiSettingsModesTab from './tabs/AiSettingsModesTab.vue';
import AiSettingsPermissionsTab from './tabs/AiSettingsPermissionsTab.vue';
import { useAiSettingsView } from './useAiSettingsView';

defineEmits(['close']);

const {
  activeTab,
  tabTitles,
  currentProject,
  profiles,
  activeProfile,
  isLoading,
  availableModels,
  isFetchingModels,
  fetchError,
  handleProfileSelect,
  createNewProfile,
  deleteActiveProfile,
  handleSaveProfile,
  handleProviderChange,
  handleFetchModels,
  handleSavePermissions
} = useAiSettingsView();
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsView.css"></style>
