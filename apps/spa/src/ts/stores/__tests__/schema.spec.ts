import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSchemaStore } from '../schema';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

vi.mock('@/stores/shell', () => ({
  useShellStore: vi.fn().mockReturnValue({ projectName: 'my_project' }),
}));

describe('schema store', () => {
  let store: ReturnType<typeof useSchemaStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useSchemaStore();
  });

  describe('loadSchema', () => {
    it('returns cached schema immediately without fetching', async () => {
      store.schemaCache['cached_type'] = { titleField: 'title' };
      const res = await store.loadSchema('cached_type');
      expect(res).toEqual({ titleField: 'title' });
      expect(api.getEntitySchemas).not.toHaveBeenCalled();
    });

    it('loads and parses schema from backend with dynamic containers', async () => {
      vi.mocked(api.getEntitySchemas).mockResolvedValue([
        {
          type_key: 'custom_npc',
          full_schema: {
            titleField: 'name',
            sections: [
              {
                title: 'General',
                dynamicContainers: [
                  { template: 'traits' },
                  { id: 'custom_id', dataPath: 'custom_path' },
                  {},
                ],
              },
            ],
          },
        } as any,
      ]);

      const res = await store.loadSchema('custom_npc');
      expect(res).toBeDefined();
      expect(res.sections[0].dynamicContainers[0].id).toBe('dyn_traits');
      expect(res.sections[0].dynamicContainers[0].dataPath).toBe('dyn_traits');
      expect(res.sections[0].dynamicContainers[1].id).toBe('custom_id');
      expect(res.sections[0].dynamicContainers[2].id).toBe('dyn_2');
    });

    it('falls back to static json fetch for static types if backend lacks schema', async () => {
      vi.mocked(api.getEntitySchemas).mockResolvedValue([]);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ titleField: 'name', static: true }),
      });
      global.fetch = mockFetch as any;

      const res = await store.loadSchema('character');
      expect(mockFetch).toHaveBeenCalledWith('/struct/editor/character.json');
      expect(res).toEqual({ titleField: 'name', static: true });
    });

    it('handles exceptions gracefully and returns null on failure', async () => {
      vi.mocked(api.getEntitySchemas).mockRejectedValue(new Error('Network error'));
      const res = await store.loadSchema('unknown_error_type');
      expect(res).toBeNull();
    });
  });

  describe('getEntityDisplayName', () => {
    it('returns titleField value when schema is loaded', () => {
      store.schemaCache['character'] = {
        titleField: 'name',
      };

      const entity = { name: 'Arthur Pendragon', age: 30 };
      expect(store.getEntityDisplayName(entity, 'character')).toBe('Arthur Pendragon');
    });

    it('returns nested titleField value', () => {
      store.schemaCache['location'] = {
        titleField: 'info.title',
      };

      const entity = { info: { title: 'Camelot Castle' } };
      expect(store.getEntityDisplayName(entity, 'location')).toBe('Camelot Castle');
    });

    it('falls back to first string key or ID if no titleField matched', () => {
      const entity = { description: 'A hidden realm', id: 'loc_123456789' };
      expect(store.getEntityDisplayName(entity)).toBe('A hidden realm');

      const entityWithNonStringKey = { count: 42, id: 'loc_abcdef123456' };
      expect(store.getEntityDisplayName(entityWithNonStringKey)).toBe('[loc_abcd]');
    });

    it('returns "Без названия" for empty/null entity', () => {
      expect(store.getEntityDisplayName(null as any)).toBe('Без названия');
    });
  });
});
