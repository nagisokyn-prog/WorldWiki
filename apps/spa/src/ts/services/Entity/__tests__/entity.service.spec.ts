import { describe, it, expect, vi, beforeEach } from 'vitest';
import { entityService } from '../entity.service';
import { entityApi } from '../entity.api';

vi.mock('../entity.api', () => ({
  entityApi: {
    getEntityList: vi.fn(),
    getEntity: vi.fn(),
    saveEntity: vi.fn(),
    deleteEntity: vi.fn(),
  },
}));

describe('entityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns empty array if type is falsy', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await entityService.list('p1', '');
      expect(res).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('parses array and stringified items correctly', async () => {
      vi.mocked(entityApi.getEntityList).mockResolvedValueOnce({
        characters: [
          { id: '1', name: 'Hero' },
          JSON.stringify({ id: '2', name: 'Villain' }),
          'invalid json',
        ],
      } as any);

      const res = await entityService.list('p1', 'character', { tag: 'main' });

      expect(entityApi.getEntityList).toHaveBeenCalledWith('p1', 'character', { tag: 'main' });
      expect(res).toEqual([
        { id: '1', name: 'Hero' },
        { id: '2', name: 'Villain' },
      ]);
    });

    it('handles type ending with s and direct array response', async () => {
      vi.mocked(entityApi.getEntityList).mockResolvedValueOnce([
        { id: 'sp1', name: 'Elf' }
      ] as any);

      const res = await entityService.list('p1', 'species');
      expect(res).toEqual([{ id: 'sp1', name: 'Elf' }]);
    });

    it('handles object without plural key', async () => {
      vi.mocked(entityApi.getEntityList).mockResolvedValueOnce({
        unrelated: [{ id: '1' }],
      } as any);

      const res = await entityService.list('p1', 'character');
      expect(res).toEqual([]);
    });

    it('rethrows error on load failure', async () => {
      vi.mocked(entityApi.getEntityList).mockRejectedValueOnce(new Error('Load error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(entityService.list('p1', 'spell')).rejects.toThrow('Load error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('get, save, delete', () => {
    it('get calls entityApi.getEntity', async () => {
      vi.mocked(entityApi.getEntity).mockResolvedValueOnce({ id: '1', name: 'Hero' } as any);
      const res = await entityService.get('p1', 'character', '1');
      expect(entityApi.getEntity).toHaveBeenCalledWith('p1', 'character', '1');
      expect(res).toEqual({ id: '1', name: 'Hero' });
    });

    it('save calls entityApi.saveEntity with and without id', async () => {
      vi.mocked(entityApi.saveEntity).mockResolvedValue({ success: true, id: '1' });
      const res1 = await entityService.save('p1', 'character', { id: '1', name: 'Hero' } as any, '1');
      expect(entityApi.saveEntity).toHaveBeenCalledWith('p1', 'character', { id: '1', name: 'Hero' }, '1', 'Hero');
      expect(res1).toEqual({ success: true, id: '1' });

      const res2 = await entityService.save('p1', 'character', { name: 'Hero 2' } as any);
      expect(entityApi.saveEntity).toHaveBeenCalledWith('p1', 'character', { name: 'Hero 2' }, undefined, 'Hero 2');
      expect(res2).toEqual({ success: true, id: '1' });
    });

    it('delete calls entityApi.deleteEntity', async () => {
      vi.mocked(entityApi.deleteEntity).mockResolvedValueOnce({ success: true });
      const res = await entityService.delete('p1', 'character', '1');
      expect(entityApi.deleteEntity).toHaveBeenCalledWith('p1', 'character', '1');
      expect(res).toEqual({ success: true });
    });
  });
});
