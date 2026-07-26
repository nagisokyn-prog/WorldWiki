import { invoke } from '@tauri-apps/api/core';
import type { ConnectionData } from './connection.api';

export const batchApi = {
  getEntitiesBatch: async (
    project: string,
    entityTypes: string[]
  ): Promise<Record<string, any[]>> => {
    try {
      return await invoke('get_entities_batch', { project, entityTypes });
    } catch (e) {
      console.error('[batchApi] getEntitiesBatch error:', e);
      return {};
    }
  },

  upsertConnectionsBatch: async (
    project: string,
    sourceType: string,
    sourceId: string,
    connections: ConnectionData[]
  ): Promise<{ success: boolean }> => {
    try {
      // Подготавливаем формат связей для Rust
      const formattedConnections = connections.map(conn => ({
        in: conn.source ? `${conn.source.entityType}:${conn.source.entityId}` : '',
        out: conn.target ? `${conn.target.entityType}:${conn.target.entityId}` : '',
        rel_type: conn.role || '',
        description: conn.description || '',
        start_chapter: conn.period?.start_chapter || '',
        end_chapter: conn.period?.end_chapter || ''
      }));

      await invoke('upsert_connections_batch', { 
        project, 
        sourceType, 
        sourceId, 
        connections: formattedConnections 
      });
      return { success: true };
    } catch (e) {
      console.error('[batchApi] upsertConnectionsBatch error:', e);
      return { success: false };
    }
  },

  saveEntityWithRelations: async (
    project: string,
    entity: any,
    foreignUpdates: any[]
  ): Promise<any> => {
    try {
      return await invoke('save_entity_with_relations', { 
        project, 
        entity, 
        foreignUpdates 
      });
    } catch (e) {
      console.error('[batchApi] saveEntityWithRelations error:', e);
      throw e;
    }
  }
};
