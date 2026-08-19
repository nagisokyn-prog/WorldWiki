import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiProfilesApi } from '../aiProfiles.api';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('aiProfilesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets profiles', async () => {
    const mockProfiles = [{ id: 'p1', name: 'Profile 1' }];
    vi.mocked(invoke).mockResolvedValueOnce(mockProfiles);

    const res = await aiProfilesApi.getProfiles('proj_1');
    expect(invoke).toHaveBeenCalledWith('get_aiprofiles', { project: 'proj_1' });
    expect(res).toEqual(mockProfiles);
  });

  it('saves profile', async () => {
    const profile: any = { id: 'p1', name: 'Saved' };
    vi.mocked(invoke).mockResolvedValueOnce(profile);

    const res = await aiProfilesApi.saveProfile(profile);
    expect(invoke).toHaveBeenCalledWith('save_aiprofile', { data: profile });
    expect(res).toEqual(profile);
  });

  it('deletes profile', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await aiProfilesApi.deleteProfile('proj_1', 'p1');
    expect(invoke).toHaveBeenCalledWith('delete_aiprofile', { project: 'proj_1', id: 'p1' });
  });
});
