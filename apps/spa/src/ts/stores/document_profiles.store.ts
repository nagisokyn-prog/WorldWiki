import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { AcademicGOSTProfile, DEFAULT_PROFILES } from '../services/document/profiles/defaults';
import type { DocumentProfile } from '../services/document/profiles/types';

export const useDocumentProfilesStore = defineStore('documentProfiles', () => {
  const activeProfileId = ref<string>('gost_academic');
  const customProfiles = ref<Map<string, DocumentProfile>>(new Map());

  const activeProfile = computed<DocumentProfile>(() => {
    if (customProfiles.value.has(activeProfileId.value)) {
      const custom = customProfiles.value.get(activeProfileId.value);
      if (custom) {
        return custom;
      }
    }

    return DEFAULT_PROFILES[activeProfileId.value] || AcademicGOSTProfile;
  });

  const allProfiles = computed<DocumentProfile[]>(() => {
    const defaults = Object.values(DEFAULT_PROFILES);
    const customs = Array.from(customProfiles.value.values());
    return [...defaults, ...customs];
  });

  function setProfile(profileId: string): void {
    if (DEFAULT_PROFILES[profileId] || customProfiles.value.has(profileId)) {
      activeProfileId.value = profileId;
    }
  }

  function registerCustomProfile(profile: DocumentProfile): void {
    customProfiles.value.set(profile.id, profile);
  }

  function removeCustomProfile(profileId: string): void {
    if (customProfiles.value.has(profileId)) {
      customProfiles.value.delete(profileId);
      if (activeProfileId.value === profileId) {
        activeProfileId.value = 'gost_academic';
      }
    }
  }

  return {
    activeProfileId,
    activeProfile,
    allProfiles,
    setProfile,
    registerCustomProfile,
    removeCustomProfile
  };
});
