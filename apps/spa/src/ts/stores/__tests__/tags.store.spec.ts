import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTagsStore } from '../tags.store';
import * as api from '../../services/api.client';
import { clearCache } from '../../utils/requestCache';

vi.mock('../../services/api.client', () => ({
  getTags: vi.fn(),
  saveTag: vi.fn(),
  deleteTag: vi.fn(),
}));

describe('tags.store', () => {
  let store: ReturnType<typeof useTagsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    clearCache();
    vi.clearAllMocks();
    store = useTagsStore();
  });

  describe('init', () => {
    it('loads tags from API and caches them', async () => {
      const mockTags = [
        { id: 'tag_1', name: 'Protagonist', color: '#ff0000' },
      ];
      vi.mocked(api.getTags).mockResolvedValue(mockTags as any);

      await store.init('proj_1');

      expect(store.project).toBe('proj_1');
      expect(store.globalTags).toEqual(mockTags);
      expect(store.isInitialized).toBe(true);

      // Re-init with same project shouldn't re-fetch
      await store.init('proj_1');
      expect(api.getTags).toHaveBeenCalledTimes(1);
    });

    it('handles null return from api.getTags and defaults to empty array', async () => {
      vi.mocked(api.getTags).mockResolvedValue(null as any);
      await store.init('proj_null');
      expect(store.globalTags).toEqual([]);
    });
  });

  describe('createNewTag', () => {
    it('creates and appends new tag if not already existing', async () => {
      store.project = 'proj_1';
      store.globalTags = [{ name: 'Existing', color: '#000000' }];

      await store.createNewTag('New Tag');

      expect(api.saveTag).toHaveBeenCalledWith(
        'proj_1',
        expect.objectContaining({ name: 'New Tag', color: 'var(--accent)' })
      );
      expect(store.globalTags).toHaveLength(2);
      expect(store.globalTags[1].name).toBe('New Tag');
    });

    it('does not create duplicate tag case-insensitively', async () => {
      store.project = 'proj_1';
      store.globalTags = [{ name: 'Existing', color: '#000000' }];

      await store.createNewTag('existing');

      expect(api.saveTag).not.toHaveBeenCalled();
      expect(store.globalTags).toHaveLength(1);
    });
  });

  describe('deleteTag', () => {
    it('deletes tag by name via API and updates store', async () => {
      store.project = 'proj_1';
      store.globalTags = [
        { id: 't1', name: 'Tag 1', color: '#111' },
        { id: 't2', name: 'Tag 2', color: '#222' },
      ];

      await store.deleteTag('Tag 1');

      expect(api.deleteTag).toHaveBeenCalledWith('t1');
      expect(store.globalTags).toHaveLength(1);
      expect(store.globalTags[0].name).toBe('Tag 2');
    });
  });

  describe('saveTag', () => {
    it('updates existing tag details', async () => {
      store.project = 'proj_1';
      store.globalTags = [{ id: 't1', name: 'OldName', color: '#111' }];

      await store.saveTag('OldName', 'NewName', '#999');

      expect(api.saveTag).toHaveBeenCalledWith(
        'proj_1',
        expect.objectContaining({ id: 't1', name: 'NewName', color: '#999' })
      );
      expect(store.globalTags[0]).toEqual({ id: 't1', name: 'NewName', color: '#999' });
    });

    it('creates new tag when oldName does not match any existing tag', async () => {
      store.project = 'proj_1';
      store.globalTags = [{ id: 't1', name: 'Other', color: '#111' }];

      await store.saveTag('NonExistent', 'BrandNew', '#abc');
      expect(store.globalTags).toHaveLength(2);
      expect(store.globalTags[1]).toEqual({ name: 'BrandNew', color: '#abc' });
    });
  });

  describe('Additional branch edge cases for tags.store', () => {
    it('handles init with cache and catch error path', async () => {
      // 1. Cached path
      const { setCache } = await import('../../utils/requestCache');
      setCache('tags:cached_proj', [{ id: 't_c', name: 'Cached', color: '#000' }]);

      await store.init('cached_proj');
      expect(store.globalTags).toEqual([{ id: 't_c', name: 'Cached', color: '#000' }]);
      expect(api.getTags).not.toHaveBeenCalled();

      // 2. Catch error path
      vi.mocked(api.getTags).mockRejectedValueOnce(new Error('Tag fetch error'));
      store.isInitialized = false;
      await store.init('err_proj');
      expect(store.globalTags).toEqual([]);
    });

    it('handles null project and isCreatingTag guard across createNewTag, deleteTag and saveTag', async () => {
      // 1. null project
      store.project = null;
      await store.createNewTag('New Tag');
      await store.deleteTag('Tag 1');
      await store.saveTag('Old', 'New', '#000');
      expect(api.saveTag).not.toHaveBeenCalled();
      expect(api.deleteTag).not.toHaveBeenCalled();

      // 2. isCreatingTag guard via concurrent invocation
      store.project = 'proj_1';
      let resolveSave: any;
      vi.mocked(api.saveTag).mockReturnValueOnce(new Promise(r => { resolveSave = r; }));
      const p1 = store.createNewTag('Tag In Flight');
      const p2 = store.createNewTag('Tag Skipped');
      resolveSave({});
      await Promise.all([p1, p2]);
      expect(api.saveTag).toHaveBeenCalledTimes(1);

      // 3. deleteTag without tag.id
      store.globalTags = [{ name: 'NoIdTag', color: '#111' }];
      await store.deleteTag('NoIdTag');
      expect(api.deleteTag).not.toHaveBeenCalled();
      expect(store.globalTags).toEqual([]);
    });
  });
});

