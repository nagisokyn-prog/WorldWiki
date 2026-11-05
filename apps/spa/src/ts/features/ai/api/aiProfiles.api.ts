import { invoke } from '@tauri-apps/api/core';
import type { AiProfile } from '@/features/ai/types/ai.types';

export const aiProfilesApi = {
  async getProfiles(projectId: string): Promise<AiProfile[]> {
    return await invoke<AiProfile[]>('get_aiprofiles', { project: projectId });
  },

  async saveProfile(profile: AiProfile): Promise<AiProfile> {
    return await invoke<AiProfile>('save_aiprofile', { data: profile });
  },

  async deleteProfile(projectId: string, id: string): Promise<void> {
    await invoke('delete_aiprofile', { project: projectId, id });
  }
};
