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

    it('save calls entityApi.saveEntity', async () => {
      vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({ success: true, id: '1' });
      const res = await entityService.save('p1', 'character', { id: '1', name: 'Hero' } as any, '1');
      expect(entityApi.saveEntity).toHaveBeenCalledWith('p1', 'character', { id: '1', name: 'Hero' }, '1', 'Hero');
      expect(res).toEqual({ success: true, id: '1' });
    });

    it('delete calls entityApi.deleteEntity', async () => {
      vi.mocked(entityApi.deleteEntity).mockResolvedValueOnce({ success: true });
      const res = await entityService.delete('p1', 'character', '1');
      expect(entityApi.deleteEntity).toHaveBeenCalledWith('p1', 'character', '1');
      expect(res).toEqual({ success: true });
    });
  });
});
