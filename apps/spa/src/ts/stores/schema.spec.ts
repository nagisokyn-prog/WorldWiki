import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSchemaStore } from './schema';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

vi.mock('@/stores/shell', () => ({
  useShellStore: () => ({ projectName: 'proj_1' }),
}));

describe('useSchemaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads schema from backend, normalizes dynamicContainers, and caches it', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([
      {
        type_key: 'hero',
        full_schema: {
          titleField: 'profile.codename',
          sections: [
            {
              dynamicContainers: [
                { template: 'chronology' },
                { id: 'custom_id', dataPath: 'custom_path' },
              ],
            },
          ],
        },
      } as any,
    ]);

    const store = useSchemaStore();
    const loaded = await store.loadSchema('hero');
    expect(loaded?.sections?.[0].dynamicContainers?.[0]).toMatchObject({
      id: 'dyn_chronology',
      dataPath: 'dyn_chronology',
    });

    // Cached hit
    await store.loadSchema('hero');
    expect(api.getEntitySchemas).toHaveBeenCalledTimes(1);

    // invalidateSchema specific & all
    store.invalidateSchema('hero');
    expect(store.schemaCache.hero).toBeUndefined();
    store.schemaCache.other = {};
    store.invalidateSchema();
    expect(store.schemaCache).toEqual({});
  });

  it('falls back to static JSON when backend has no schema and handles errors', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([]);
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ titleField: 'name' }),
    } as any);

    const store = useSchemaStore();
    const chSchema = await store.loadSchema('character');
    expect(chSchema?.titleField).toBe('name');

    // Error branch
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(api.getEntitySchemas).mockRejectedValueOnce(new Error('schema err'));
    expect(await store.loadSchema('unknown_type')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    globalThis.fetch = origFetch;
  });

  it('resolves display name across schema path, explicit fields, attributes, fallback key, and id', () => {
    const store = useSchemaStore();
    store.schemaCache.hero = { titleField: 'profile.codename' };

    expect(store.getEntityDisplayName(null as any)).toBe('Без названия');
    expect(store.getEntityDisplayName({ profile: { codename: '  Shadow  ' } }, 'hero')).toBe('Shadow');
    expect(store.getEntityDisplayName({ attributes: { profile: { codename: 'Ghost' } } }, 'hero')).toBe('Ghost');
    expect(store.getEntityDisplayName({ name: '  Arthur  ' })).toBe('Arthur');
    expect(store.getEntityDisplayName({ attributes: { название: 'Трон' } })).toBe('Трон');
    expect(store.getEntityDisplayName({ id: 'ent:1', custom_field: 'CustomVal' })).toBe('CustomVal');
    expect(store.getEntityDisplayName({ id: 'entities:123456789' })).toBe('[entities]');
    expect(store.getEntityDisplayName({})).toBe('[Unknown]');
  });

  it('invalidates schema cache on ww:schema-updated event', () => {
    const store = useSchemaStore();
    store.schemaCache.hero = { titleField: 'name' };
    window.dispatchEvent(new CustomEvent('ww:schema-updated', { detail: { entityType: 'hero' } }));
    expect(store.schemaCache.hero).toBeUndefined();
  });
});
