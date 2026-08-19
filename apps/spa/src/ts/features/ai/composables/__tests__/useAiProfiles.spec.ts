import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiProfiles } from '../useAiProfiles';
import { aiProfilesApi } from '../../api/aiProfiles.api';

vi.mock('../../api/aiProfiles.api', () => ({
  aiProfilesApi: {
    getProfiles: vi.fn(),
    saveProfile: vi.fn((p) => Promise.resolve({ ...p, id: p.id || 'prof_generated_id' })),
    deleteProfile: vi.fn(),
  },
}));

describe('useAiProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadProfiles', () => {
    it('loads profiles and sets active profile', async () => {
      const mockProfiles = [
        { id: 'p1', name: 'Claude Sonnet', is_active: false },
        { id: 'p2', name: 'GPT-4o', is_active: true },
      ];
      vi.mocked(aiProfilesApi.getProfiles).mockResolvedValue(mockProfiles as any);

      const { profiles, activeProfileId, activeProfile, loadProfiles } = useAiProfiles('proj_1');
      await loadProfiles();

      expect(profiles.value).toEqual(mockProfiles);
      expect(activeProfileId.value).toBe('p2');
      expect(activeProfile.value?.name).toBe('GPT-4o');
    });

    it('creates default profile when list is empty', async () => {
      vi.mocked(aiProfilesApi.getProfiles).mockResolvedValue([]);

      const { profiles, activeProfile, loadProfiles } = useAiProfiles('proj_1');
      await loadProfiles();

      expect(aiProfilesApi.saveProfile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Default Profile', is_active: true })
      );
      expect(profiles.value).toHaveLength(1);
      expect(activeProfile.value?.name).toBe('Default Profile');
    });
  });

  describe('createNewProfile & deleteActiveProfile', () => {
    it('creates and appends new profile', async () => {
      const mockProfiles = [
        { id: 'p1', name: 'Profile 1', is_active: true },
      ];
      vi.mocked(aiProfilesApi.getProfiles).mockResolvedValue(mockProfiles as any);

      const profilesHook = useAiProfiles('proj_1');
      await profilesHook.loadProfiles();

      await profilesHook.createNewProfile();

      expect(profilesHook.profiles.value).toHaveLength(2);
      expect(profilesHook.activeProfileId.value).toBe('prof_generated_id');
    });

    it('deletes active profile only if more than 1 profile exists', async () => {
      const mockProfiles = [
        { id: 'p1', name: 'Profile 1', is_active: true },
        { id: 'p2', name: 'Profile 2', is_active: false },
      ];
      vi.mocked(aiProfilesApi.getProfiles).mockResolvedValue(mockProfiles as any);

      const profilesHook = useAiProfiles('proj_1');
      await profilesHook.loadProfiles();
      profilesHook.activeProfileId.value = 'p1';

      await profilesHook.deleteActiveProfile();

      expect(aiProfilesApi.deleteProfile).toHaveBeenCalledWith('proj_1', 'p1');
      expect(profilesHook.profiles.value).toHaveLength(1);
      expect(profilesHook.activeProfileId.value).toBe('p2');

      // Attempting to delete the last remaining profile should do nothing
      await profilesHook.deleteActiveProfile();
      expect(profilesHook.profiles.value).toHaveLength(1);
    });
  });
});
