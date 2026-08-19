import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchApi } from '../batch.api';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('batchApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntitiesBatch', () => {
    it('successfully fetches entities batch from backend', async () => {
      const mockResult = { character: [{ id: '1', name: 'Hero' }] };
      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const res = await batchApi.getEntitiesBatch('my-project', ['character']);

      expect(invoke).toHaveBeenCalledWith('get_entities_batch', {
        project: 'my-project',
        entityTypes: ['character'],
      });
      expect(res).toEqual(mockResult);
    });

    it('returns empty object when invoke throws error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await batchApi.getEntitiesBatch('my-project', ['character']);

      expect(res).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('upsertConnectionsBatch', () => {
    it('formats connections and sends upsert request', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const connections = [
        {
          source: { entityType: 'char', entityId: 'c1' },
          target: { entityType: 'char', entityId: 'c2' },
          role: 'friend',
          description: 'Childhood friends',
          period: { start_chapter: '1', end_chapter: '5' },
        },
        {
          // Empty fallbacks
        } as any,
      ];

      const res = await batchApi.upsertConnectionsBatch('my-project', 'char', 'c1', connections);

      expect(invoke).toHaveBeenCalledWith('upsert_connections_batch', {
        project: 'my-project',
        sourceType: 'char',
        sourceId: 'c1',
        connections: [
          {
            in: 'c1',
            out: 'c2',
            rel_type: 'friend',
            description: 'Childhood friends',
            start_chapter: '1',
            end_chapter: '5',
          },
          {
            in: '',
            out: '',
            rel_type: '',
            description: '',
            start_chapter: '',
            end_chapter: '',
          },
        ],
      });
      expect(res).toEqual({ success: true });
    });

    it('returns success: false when invoke fails', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed upsert'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await batchApi.upsertConnectionsBatch('my-project', 'char', 'c1', []);

      expect(res).toEqual({ success: false });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('saveEntityWithRelations', () => {
    it('successfully saves entity with relations', async () => {
      const mockResult = { id: 'saved_1' };
      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const res = await batchApi.saveEntityWithRelations('my-project', { name: 'E1' }, [{ update: 1 }]);

      expect(invoke).toHaveBeenCalledWith('save_entity_with_relations', {
        project: 'my-project',
        entity: { name: 'E1' },
        foreignUpdates: [{ update: 1 }],
      });
      expect(res).toEqual(mockResult);
    });

    it('rethrows error on failure', async () => {
      const error = new Error('Save error');
      vi.mocked(invoke).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(batchApi.saveEntityWithRelations('my-project', {}, [])).rejects.toThrow('Save error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
