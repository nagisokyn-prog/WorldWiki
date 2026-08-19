import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSchemaStore } from '../schema';

describe('schema store', () => {
  let store: ReturnType<typeof useSchemaStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useSchemaStore();
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
