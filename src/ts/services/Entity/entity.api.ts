/**
 * @file entity.api.ts
 * @description API methods for Entity Domain
 */

import { invoke } from '../../../../tauri-surreal-kit/frontend/src/js/services/api.service';
import { projectRecordId } from '../api.service';
import type { EntityData, SchemaInfo, ConnectionData } from './entity.types';

export const entityApi = {
  searchEntities: async (projectName: string, query: string): Promise<EntityData[]> => {
    try {
      return await invoke('search_entities', { project: projectName, query });
    } catch (error) {
      console.error('API Error (search_entities):', error);
      return [];
    }
  },

  getEntityList: (project: string, type: string, filters?: Record<string, unknown>): Promise<any[]> =>
    invoke<any[]>('list_entities', { project, entityType: type, filters: filters || null }),

  getEntity: (project: string, type: string, id: string): Promise<Record<string, unknown>> =>
    invoke<Record<string, unknown>>('get_entity', { id }),

  saveEntity: (project: string, type: string, data: Record<string, unknown>, id?: string, name?: string): Promise<{ success: boolean; id?: string }> => {
    const actualData = JSON.parse(JSON.stringify(data));
    let extractedName = name || 'Новая сущность';

    if (!name) {
      const keys = Object.keys(actualData);
      if (keys.length > 0) {
        const firstVal = actualData[keys[0]];
        if (typeof firstVal === 'string' && firstVal.trim() !== '') {
          extractedName = firstVal.trim();
        }
      }
    }

    const SYSTEM_FIELDS = new Set(['id', 'project_id', 'entity_type', 'name', 'description', 'tags', 'embedding', 'created_at', 'updated_at', 'attributes']);
    const cleanAttributes: Record<string, unknown> = {};
    for (const k of Object.keys(actualData)) {
      if (!SYSTEM_FIELDS.has(k)) cleanAttributes[k] = actualData[k];
    }

    const entity = {
      id: id ?? null,
      project_id: projectRecordId(project),
      entity_type: type,
      name: extractedName,
      description: actualData.description || null,
      attributes: cleanAttributes,
      tags: actualData.tags || [],
    };
    return invoke<{ success: boolean; id?: string }>('save_entity', { project, entity });
  },

  deleteEntity: (project: string, type: string, id: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_entity', { id }),
    
  getSchemas: async (project: string): Promise<Record<string, SchemaInfo>> => {
    const list = await invoke<any[]>('get_entity_schemas', { project });
    const dict: Record<string, SchemaInfo> = {};
    for (const s of list) {
      if (s.name) dict[s.name] = s;
    }
    return dict;
  },

  saveSchema: (project: string, name: string, schema: any): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_entity_schema', { 
      project, 
      schema: {
        project_id: projectRecordId(project),
        name,
        ...schema
      } 
    }),

  getConnections: (entityId: string): Promise<ConnectionData[]> =>
    invoke<ConnectionData[]>('get_entity_connections', { entityId }),
    
  saveConnection: (project: string, conn: ConnectionData): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_connection', { project, conn: { ...conn, project_id: projectRecordId(project) } }),
    
  deleteConnection: (id: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_connection', { id }),
};
