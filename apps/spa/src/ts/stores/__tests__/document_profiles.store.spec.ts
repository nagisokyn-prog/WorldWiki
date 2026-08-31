import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentProfilesStore } from '../document_profiles.store';

describe('document_profiles.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with AcademicGOSTProfile by default', () => {
    const store = useDocumentProfilesStore();
    expect(store.activeProfileId).toBe('gost_academic');
    expect(store.activeProfile.id).toBe('gost_academic');
    expect(store.activeProfile.page.format).toBe('A4');
  });

  it('switches between default profiles', () => {
    const store = useDocumentProfilesStore();
    store.setProfile('novel_book');
    expect(store.activeProfileId).toBe('novel_book');
    expect(store.activeProfile.page.format).toBe('A5');

    store.setProfile('continuous_draft');
    expect(store.activeProfileId).toBe('continuous_draft');
    expect(store.activeProfile.page.format).toBe('Custom');
  });

  it('registers and activates custom profiles', () => {
    const store = useDocumentProfilesStore();
    const customProfile = {
      ...store.activeProfile,
      id: 'my_custom_lab',
      name: 'Лабораторная работа'
    };

    store.registerCustomProfile(customProfile);
    expect(store.allProfiles.some((p) => p.id === 'my_custom_lab')).toBe(true);

    store.setProfile('my_custom_lab');
    expect(store.activeProfileId).toBe('my_custom_lab');
    expect(store.activeProfile.name).toBe('Лабораторная работа');
  });

  it('falls back to gost_academic when active custom profile is removed', () => {
    const store = useDocumentProfilesStore();
    const customProfile = {
      ...store.activeProfile,
      id: 'temp_profile',
      name: 'Temp'
    };

    store.registerCustomProfile(customProfile);
    store.setProfile('temp_profile');
    expect(store.activeProfileId).toBe('temp_profile');

    store.removeCustomProfile('temp_profile');
    expect(store.activeProfileId).toBe('gost_academic');
  });
});
