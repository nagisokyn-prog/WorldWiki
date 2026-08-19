import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadSchema, getValueByPath, getEntityDisplayName } from '../entity.utils';
import { entityApi } from '../entity.api';

vi.mock('../entity.api', () => ({
  entityApi: {
    getSchemas: vi.fn(),
  },
}));

describe('entity.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSchema', () => {
    it('loads schema from API and caches it', async () => {
      vi.mocked(entityApi.getSchemas).mockResolvedValueOnce({
        hero: { name: 'Hero Schema' } as any,
      });

      const schema1 = await loadSchema('p1', 'hero');
      expect(schema1).toEqual({ name: 'Hero Schema' });

      // Cached call
      const schemaCached = await loadSchema('p1', 'hero');
      expect(schemaCached).toEqual({ name: 'Hero Schema' });
      expect(entityApi.getSchemas).toHaveBeenCalledTimes(1);
    });

    it('returns null on failure', async () => {
      vi.mocked(entityApi.getSchemas).mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await loadSchema('p1', 'unknown_type');
      expect(res).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getValueByPath', () => {
    it('extracts nested property correctly', () => {
      const obj = { user: { profile: { name: 'Alice' } } };
      expect(getValueByPath(obj, 'user.profile.name')).toBe('Alice');
      expect(getValueByPath(obj, 'user.age')).toBeUndefined();
      expect(getValueByPath(obj, '')).toBeUndefined();
      expect(getValueByPath(null, 'user')).toBeUndefined();
    });
  });

  describe('getEntityDisplayName', () => {
    it('returns fallback if entity is falsy', () => {
      expect(getEntityDisplayName(null as any)).toBe('Без названия');
    });

    it('uses schema titleField when present', () => {
      const entity = { details: { title: 'King Arthur' }, fallback: 'Not used' };
      const schema = { titleField: 'details.title' } as any;

      expect(getEntityDisplayName(entity, schema)).toBe('King Arthur');
    });

    it('falls back to first string key when titleField is absent', () => {
      const entity = { alias: 'Merlin' };
      expect(getEntityDisplayName(entity, null)).toBe('Merlin');
    });

    it('falls back to id slice when no valid string property', () => {
      const entity = { count: 42, id: 'entity_987654321' };
      expect(getEntityDisplayName(entity, null)).toBe('[entity_9]');
    });
  });
});
