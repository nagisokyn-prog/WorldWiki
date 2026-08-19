// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EntityService } from '../../../src/ts/services/entity.service';

describe('EntityService', () => {
  let mockInvoke: any;

  beforeEach(() => {
    mockInvoke = vi.fn();
    (window as any).__TAURI__ = {
      core: {
        invoke: mockInvoke,
      },
    };
  });

  afterEach(() => {
    delete (window as any).__TAURI__;
  });

  it('getAll fetches entities and returns array', async () => {
    const service = new EntityService<{ id: string; name: string }>('character');
    mockInvoke.mockResolvedValueOnce([{ id: 'c1', name: 'Arthur' }]);

    const res = await service.getAll('project_1');
    expect(mockInvoke).toHaveBeenCalledWith('get_characters', { project: 'project_1' });
    expect(res).toEqual([{ id: 'c1', name: 'Arthur' }]);
  });

  it('getAll returns empty array on failure', async () => {
    const service = new EntityService('character');
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));

    const res = await service.getAll('project_1');
    expect(res).toEqual([]);
  });

  it('getOne fetches single entity by id', async () => {
    const service = new EntityService<{ id: string }>('item');
    mockInvoke.mockResolvedValueOnce({ id: 'item_1' });

    const res = await service.getOne('item_1');
    expect(mockInvoke).toHaveBeenCalledWith('get_item', { id: 'item_1' });
    expect(res).toEqual({ id: 'item_1' });
  });

  it('save upserts entity', async () => {
    const service = new EntityService<{ id: string; name: string }>('location');
    mockInvoke.mockResolvedValueOnce({ id: 'loc_1', name: 'Camelot' });

    const res = await service.save({ name: 'Camelot' });
    expect(mockInvoke).toHaveBeenCalledWith('save_location', { data: { name: 'Camelot' } });
    expect(res).toEqual({ id: 'loc_1', name: 'Camelot' });
  });

  it('delete deletes entity by id and returns boolean', async () => {
    const service = new EntityService('location');
    mockInvoke.mockResolvedValueOnce(undefined);

    const res = await service.delete('loc_1');
    expect(mockInvoke).toHaveBeenCalledWith('delete_location', { id: 'loc_1' });
    expect(res).toBe(true);

    mockInvoke.mockRejectedValueOnce(new Error('Fail'));
    const failRes = await service.delete('loc_1');
    expect(failRes).toBe(false);
  });

  it('search executes fulltext search', async () => {
    const service = new EntityService('chapter');
    mockInvoke.mockResolvedValueOnce([{ entity: { id: 'ch1' }, score: 0.95 }]);

    const res = await service.search('proj_1', 'magic');
    expect(mockInvoke).toHaveBeenCalledWith('search_chapters', { project: 'proj_1', query: 'magic' });
    expect(res).toHaveLength(1);
    expect(res[0].score).toBe(0.95);
  });

  it('handles error in getOne, save and search gracefully', async () => {
    const service = new EntityService('spell');
    mockInvoke.mockRejectedValue(new Error('Backend error'));

    expect(await service.getOne('s1')).toBeNull();
    expect(await service.save({ name: 'Fireball' } as any)).toBeNull();
    expect(await service.search('p1', 'fire')).toEqual([]);
  });
});
