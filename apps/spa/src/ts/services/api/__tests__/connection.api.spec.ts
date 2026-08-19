import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectionApi } from '../connection.api';
import { invoke, processIds } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn(),
  processIds: vi.fn((x) => x),
}));

describe('connectionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getConnections calls get_connections and processes ids', async () => {
    const mockList = [{ id: 'conn1', role: 'ally' }];
    vi.mocked(invoke).mockResolvedValueOnce(mockList);

    const res = await connectionApi.getConnections('p1', 'ch1');

    expect(invoke).toHaveBeenCalledWith('get_connections', { project: 'p1', chapter: 'ch1' });
    expect(processIds).toHaveBeenCalled();
    expect(res).toEqual(mockList);
  });

  it('getConnectionsByEntity calls get_connections_by_entity', async () => {
    const mockList = [{ id: 'conn2' }];
    vi.mocked(invoke).mockResolvedValueOnce(mockList);

    const res = await connectionApi.getConnectionsByEntity('p1', 'character', 'char1');

    expect(invoke).toHaveBeenCalledWith('get_connections_by_entity', {
      project: 'p1',
      entityType: 'character',
      entityId: 'char1',
    });
    expect(res).toEqual(mockList);
  });

  it('removeConnectionsBySource calls remove_connections_by_source', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ success: true });

    const res = await connectionApi.removeConnectionsBySource('p1', 'character', 'char1');

    expect(invoke).toHaveBeenCalledWith('remove_connections_by_source', {
      project: 'p1',
      entityType: 'character',
      entityId: 'char1',
    });
    expect(res).toEqual({ success: true });
  });

  it('saveConnections calls save_connections', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ success: true });

    const connections = [{ role: 'rival' }];
    const res = await connectionApi.saveConnections('p1', 'char1', connections as any);

    expect(invoke).toHaveBeenCalledWith('save_connections', {
      project: 'p1',
      sourceId: 'char1',
      data: connections,
    });
    expect(res).toEqual({ success: true });
  });
});
