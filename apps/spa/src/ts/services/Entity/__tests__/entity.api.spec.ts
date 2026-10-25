import { describe, it, expect, vi, beforeEach } from 'vitest';
import { entityApi } from '../entity.api';
import * as components from '@worldwiki/components';

vi.mock('@worldwiki/components', () => {
  return {
    invoke: vi.fn(),
    processIds: vi.fn((item) => item),
  };
});

describe('entityApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchEntities', () => {
    it('returns search results from invoke', async () => {
      const mockResults = [{ id: 'e1', name: 'Hero' }];
      vi.mocked(components.invoke).mockResolvedValueOnce(mockResults);

      const res = await entityApi.searchEntities('proj_1', 'hero');

      expect(components.invoke).toHaveBeenCalledWith('search_entities', {
        project: 'proj_1',
        query: 'hero',
      });
      expect(res).toEqual(mockResults);
    });

    it('returns empty array when searchEntities fails', async () => {
      vi.mocked(components.invoke).mockRejectedValueOnce(new Error('Search failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await entityApi.searchEntities('proj_1', 'hero');

      expect(res).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getEntity', () => {
    it('should properly extract attributes to the root level while preserving system fields', async () => {
      const mockBackendResponse = {
        id: 'char_123',
        project_id: 'proj_1',
        entity_type: 'character',
        name: 'Test Character',
        description: 'A test character',
        tags: ['test'],
        attributes: {
          age: 25,
          bio: 'Very interesting bio',
          stats: { str: 10, dex: 15 },
        },
      };

      vi.mocked(components.invoke).mockResolvedValueOnce(mockBackendResponse);

      const result = await entityApi.getEntity('proj_1', 'character', 'char_123');

      expect(components.invoke).toHaveBeenCalledWith('get_entity', { id: 'char_123' });
      expect(result.id).toBe('char_123');
      expect(result.name).toBe('Test Character');
      expect(result.age).toBe(25);
      expect(result.bio).toBe('Very interesting bio');
      expect((result.stats as any).str).toBe(10);
      expect(result.attributes).toBeUndefined();
    });

    it('should handle entities without attributes safely', async () => {
      const mockBackendResponse = {
        id: 'char_456',
        entity_type: 'location',
        name: 'Empty Location',
      };
      vi.mocked(components.invoke).mockResolvedValueOnce(mockBackendResponse);

      const result = await entityApi.getEntity('proj_1', 'location', 'char_456');

      expect(result.id).toBe('char_456');
      expect(result.name).toBe('Empty Location');
    });

    it('should return null if backend returns null', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce(null);
      const result = await entityApi.getEntity('proj_1', 'character', 'not_found');
      expect(result).toBeNull();
    });
  });

  describe('getEntityList', () => {
    it('should extract attributes to root for each item in the list', async () => {
      const mockBackendList = [
        { id: 'item1', name: 'Item 1', attributes: { color: 'red' } },
        { id: 'item2', name: 'Item 2', data: { color: 'blue' } },
        null,
      ];
      vi.mocked(components.invoke).mockResolvedValueOnce(mockBackendList);

      const result = await entityApi.getEntityList('proj_1', 'item');

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Item 1');
      expect(result[0].color).toBe('red');
      expect(result[1].name).toBe('Item 2');
      expect(result[1].color).toBe('blue');
      expect(result[2]).toBeNull();
    });
  });

  describe('formatEntityPayload and saveEntity', () => {
    it('should extract name from first property if name is not given', () => {
      const flatData = {
        firstField: 'Extracted Title',
        customField: 123,
      };

      const formatted = entityApi.formatEntityPayload('proj_1', 'item', flatData);

      expect(formatted.name).toBe('Extracted Title');
      expect((formatted.attributes as any).customField).toBe(123);
    });

    it('should correctly format payload separating system fields and attributes', async () => {
      const flatDataFromUI = {
        name: 'New Character',
        description: 'Description here',
        tags: ['hero'],
        age: 30,
        bio: 'Bio text',
        custom_field: true,
      };

      const mockSaveResult = { id: 'new_123', success: true };
      vi.mocked(components.invoke).mockResolvedValueOnce(mockSaveResult);

      const result = await entityApi.saveEntity('proj_1', 'character', flatDataFromUI, undefined, 'New Character');

      expect(components.invoke).toHaveBeenCalledWith('save_entity', {
        project: 'proj_1',
        entity: expect.objectContaining({
          project_id: 'projects:proj_1',
          entity_type: 'character',
          id: null,
          name: 'New Character',
          description: 'Description here',
          tags: ['hero'],
          attributes: expect.objectContaining({
            age: 30,
            bio: 'Bio text',
            custom_field: true,
          }),
        }),
      });
      expect(result).toEqual(mockSaveResult);
    });

    it('should synchronize "теги" from UI into tags and cleanAttributes["теги"]', () => {
      const flatData = {
        name: 'Hero',
        теги: ['Ника', 'вера', 'какой-то важный статус'],
      };

      const formatted = entityApi.formatEntityPayload('proj_1', 'character', flatData);

      expect(formatted.tags).toEqual(['Ника', 'вера', 'какой-то важный статус']);
      expect((formatted.attributes as Record<string, unknown>)['теги']).toEqual(['Ника', 'вера', 'какой-то важный статус']);
    });
  });

  describe('getEntity tags synchronization', () => {
    it('populates both tags and теги from database tags array', async () => {
      const mockRawEntity = {
        id: 'entities:char_1',
        name: 'Ника',
        tags: ['Ника', 'вера'],
        attributes: { age: 25 },
      };
      vi.mocked(components.invoke).mockResolvedValueOnce(mockRawEntity);

      const res = await entityApi.getEntity('proj_1', 'character', 'entities:char_1');

      expect(res.tags).toEqual(['Ника', 'вера']);
      expect(res['теги']).toEqual(['Ника', 'вера']);
    });

    it('populates both name and название from either source in getEntity', async () => {
      const mockRawEntity = {
        id: 'entities:char_2',
        name: 'Катя',
        tags: [],
        attributes: {},
      };
      vi.mocked(components.invoke).mockResolvedValueOnce(mockRawEntity);

      const res = await entityApi.getEntity('proj_1', 'character', 'entities:char_2');

      expect(res.name).toBe('Катя');
      expect(res['название']).toBe('Катя');
    });
  });

  describe('deleteEntity & history', () => {
    it('deleteEntity calls delete_entity', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce({ success: true });

      const res = await entityApi.deleteEntity('proj_1', 'character', 'c1');

      expect(components.invoke).toHaveBeenCalledWith('delete_entity', { id: 'c1' });
      expect(res).toEqual({ success: true });
    });

    it('toggleEntityHistoryPin calls toggle_entity_history_pin', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce(undefined);

      await entityApi.toggleEntityHistoryPin('h1', true);

      expect(components.invoke).toHaveBeenCalledWith('toggle_entity_history_pin', { historyId: 'h1', isPinned: true });
    });
  });

  describe('Schemas methods', () => {
    it('getSchemas parses list from backend', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce([
        { type_key: 'char', type_name: 'Character', icon: '👤', full_schema: { fields: [] } },
      ]);

      const res = await entityApi.getSchemas('proj_1');

      expect(res).toEqual({
        char: {
          name: 'Character',
          icon: '👤',
          full_schema: { fields: [] },
        },
      });
    });

    it('getSchemas loads fallback schemas when backend list is empty', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce([]);
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Default ' + url, iconEmoji: '✨' }),
        });
      }) as any;

      const res = await entityApi.getSchemas('proj_1');

      expect(res.character).toBeDefined();
      expect(res.organization).toBeDefined();
      expect(res.state).toBeDefined();
    });

    it('getSchemaHistory and toggleSchemaHistoryPin', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce([{ id: 'sh1' }]);
      const history = await entityApi.getSchemaHistory('p1', 'char');
      expect(components.invoke).toHaveBeenCalledWith('get_schema_history', { project: 'p1', typeKey: 'char' });
      expect(history).toEqual([{ id: 'sh1' }]);

      vi.mocked(components.invoke).mockResolvedValueOnce(undefined);
      await entityApi.toggleSchemaHistoryPin('sh1', true);
      expect(components.invoke).toHaveBeenCalledWith('toggle_schema_history_pin', { historyId: 'sh1', isPinned: true });
    });

    it('saveSchema calls save_entity_schema', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce({ success: true });

      const res = await entityApi.saveSchema('proj_1', { name: 'Custom' }, 5);

      expect(components.invoke).toHaveBeenCalledWith('save_entity_schema', {
        project: 'proj_1',
        schema: {
          project_id: 'projects:proj_1',
          name: 'Custom',
        },
        maxSaves: 5,
      });
      expect(res).toEqual({ success: true });
    });

    it('handles data object and getSchemas handles fetch errors', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce({
        id: 'e1',
        data: { customField: 'value1' },
      });
      const resEnt = await entityApi.getEntity('proj_1', 'character', 'e1');
      expect(resEnt?.customField).toBe('value1');
      expect(resEnt?.data).toBeUndefined();

      // getSchemas catch error when fetch fails
      vi.mocked(components.invoke).mockResolvedValueOnce([]); // empty DB schemas
      const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Fetch failure'));

      const dict = await entityApi.getSchemas('proj_empty');
      expect(dict).toBeDefined();
      expect(spyError).toHaveBeenCalled();
      spyError.mockRestore();
    });
  });

  describe('Connections methods', () => {
    it('getConnections, saveConnection, deleteConnection', async () => {
      vi.mocked(components.invoke).mockResolvedValueOnce([{ id: 'conn_1' }]);
      const conns = await entityApi.getConnections('c1');
      expect(components.invoke).toHaveBeenCalledWith('get_entity_connections', { entityId: 'c1' });
      expect(conns).toEqual([{ id: 'conn_1' }]);

      vi.mocked(components.invoke).mockResolvedValueOnce({ success: true });
      const saveRes = await entityApi.saveConnection('proj_1', { id: 'conn_1' } as any);
      expect(components.invoke).toHaveBeenCalledWith('save_connection', {
        project: 'proj_1',
        conn: { id: 'conn_1', project_id: 'projects:proj_1' },
      });
      expect(saveRes).toEqual({ success: true });

      vi.mocked(components.invoke).mockResolvedValueOnce({ success: true });
      const delRes = await entityApi.deleteConnection('conn_1');
      expect(components.invoke).toHaveBeenCalledWith('delete_connection', { id: 'conn_1' });
      expect(delRes).toEqual({ success: true });
    });
  });
});
