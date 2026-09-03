import { ref, onMounted, watch } from 'vue';
import type { AiProfile, AiProfileSettings } from '../types/ai.types';
import { useAiProfiles } from '../composables/useAiProfiles';
import { useAiModels } from '../composables/useAiModels';

export type TabType = 'connections' | 'models' | 'local_ai' | 'modes' | 'permissions';

export const tabTitles: Record<string, string> = {
  connections: 'Подключения и API-ключи',
  models: 'Модели и логика генерации',
  local_ai: 'Центр локальных моделей',
  modes: 'Режимы и роли ИИ-помощника',
  permissions: 'Инструменты и безопасность',
};

export function useAiSettingsView() {
  const savedTab = localStorage.getItem('worldwiki_ai_settings_active_tab') as TabType;
  const activeTab = ref<TabType>(savedTab && ['connections', 'models', 'local_ai', 'modes', 'permissions'].includes(savedTab) ? savedTab : 'connections');

  watch(activeTab, (val) => {
    localStorage.setItem('worldwiki_ai_settings_active_tab', val);
  });

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

  const handleProfileSelect = (id: string) => {
    activeProfileId.value = id;
    void handleFetchModels();
  };

  const handleProviderChange = () => {
    void handleFetchModels();
  };

  const handleSaveProfile = async (updatedData?: Partial<AiProfile> | { settings: AiProfileSettings } | null) => {
    if (updatedData && activeProfile.value) {
      if ('settings' in updatedData && updatedData.settings && activeProfile.value.settings) {
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

  onMounted(async () => {
    await loadProfiles();
    void handleFetchModels();
  });

  return {
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
  };
}
