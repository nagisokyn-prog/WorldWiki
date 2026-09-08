import { ref, computed } from 'vue';
import type { AiProfile } from '../types/ai.types';
import { aiProfilesApi } from '../api/aiProfiles.api';

const profiles = ref<AiProfile[]>([]);
const activeProfileId = ref<string>('');
const isLoading = ref(false);

const activeProfile = computed(() => {
  return profiles.value.find(p => p.id === activeProfileId.value) || null;
});

export function useAiProfiles(currentProject: string) {


  const loadProfiles = async () => {
    isLoading.value = true;
    try {
      const data = await aiProfilesApi.getProfiles(currentProject);
      if (data && data.length > 0) {
        profiles.value = data;
        const active = data.find(p => p.is_active);
        activeProfileId.value = active ? active.id! : data[0].id!;
      } else {
        await createDefaultProfile();
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const createDefaultProfile = async () => {
    const newProfile: AiProfile = {
      name: 'Default Profile',
      provider: 'anthropic',
      base_url: '',
      api_key: '',
      settings: { 
        model: 'claude-3-7-sonnet-20250219', 
        temperature: 1.0,
        use_custom_temperature: false
      },
      is_active: true,
      is_global: false,
      project_id: currentProject
    };
    const created = await aiProfilesApi.saveProfile(newProfile);
    profiles.value = [created];
    activeProfileId.value = created.id!;
  };

  const createNewProfile = async () => {
    const newProfile: AiProfile = {
      name: `New Profile ${profiles.value.length + 1}`,
      provider: 'anthropic',
      base_url: '',
      api_key: '',
      settings: { 
        model: 'claude-3-5-sonnet-20241022', 
        temperature: 1.0,
        use_custom_temperature: false
      },
      is_active: false,
      is_global: false,
      project_id: currentProject
    };
    try {
      const created = await aiProfilesApi.saveProfile(newProfile);
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
      await aiProfilesApi.deleteProfile(currentProject, idToDelete);
      profiles.value = profiles.value.filter(p => p.id !== idToDelete);
      activeProfileId.value = profiles.value[0].id!;
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
  };

  const saveActiveProfile = async () => {
    if (!activeProfile.value || !activeProfile.value.id) return;
    try {
      activeProfile.value.is_active = true;
      for (const p of profiles.value) {
        if (p.id !== activeProfile.value.id && p.is_active) {
          p.is_active = false;
          p.project_id = currentProject;
          await aiProfilesApi.saveProfile(p);
        }
      }
      activeProfile.value.project_id = currentProject;
      await aiProfilesApi.saveProfile(activeProfile.value);
    } catch (err) {
      console.error('Failed to save profile:', err);
      throw err;
    }
  };

  return {
    profiles,
    activeProfileId,
    activeProfile,
    isLoading,
    loadProfiles,
    createNewProfile,
    deleteActiveProfile,
    saveActiveProfile
  };
}
