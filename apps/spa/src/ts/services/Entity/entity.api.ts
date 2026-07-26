/**
 * @file entity.api.ts
 * @description API methods for Entity Domain
 */

import { invoke, processIds } from '@worldwiki/components';
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

  getEntityList: async (project: string, type: string, filters?: Record<string, unknown>): Promise<any[]> => {
    const list = await invoke<any[]>('get_entities', { project, entityType: type, filters: filters || null });
    return list.map(processIds).map((item: any) => {
      if (item && item.data && typeof item.data === 'object') {
        return { ...item.data, id: item.id };
      }
      return item;
    });
  },

  getEntity: async (project: string, type: string, id: string): Promise<Record<string, unknown>> => {
    const detail: any = await invoke<any>('get_entity', { id });
    const processed: any = processIds(detail);
    if (processed && processed.attributes && typeof processed.attributes === 'object') {
      return { ...processed.attributes, id: processed.id };
    }
    if (processed && processed.data && typeof processed.data === 'object') {
      return { ...processed.data, id: processed.id };
    }
    return processed;
  },

  formatEntityPayload: (project: string, type: string, data: Record<string, unknown>, id?: string, name?: string): Record<string, unknown> => {
    const actualData = JSON.parse(JSON.stringify(data));
    let extractedName = name || 'Новая сущность';

    if (extractedName === 'Новая сущность' || !name) {
      const keys = Object.keys(actualData).filter(k => k !== 'id' && k !== 'project_id' && k !== 'entity_type' && k !== 'attributes');
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

    return {
      id: id ?? null,
      project_id: project,
      entity_type: type,
      name: extractedName,
      description: actualData.description || null,
      attributes: cleanAttributes,
      tags: actualData.tags || [],
    };
  },

  saveEntity: (project: string, type: string, data: Record<string, unknown>, id?: string, name?: string): Promise<{ success: boolean; id?: string }> => {
    const entity = entityApi.formatEntityPayload(project, type, data, id, name);
    return invoke<{ success: boolean; id?: string }>('save_entity', { project, entity });
  },



  deleteEntity: (project: string, type: string, id: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_entity', { id }),
    
  toggleEntityHistoryPin: (historyId: string, isPinned: boolean): Promise<void> =>
    invoke<void>('toggle_entity_history_pin', { historyId, isPinned }),

  getSchemas: async (project: string): Promise<Record<string, SchemaInfo>> => {
    const list = await invoke<any[]>('get_entity_schemas', { project });
    const dict: Record<string, SchemaInfo> = {};
    for (const s of list) {
      dict[s.type_key] = {
        name: s.type_name || s.type_key,
        icon: s.icon || '📄',
        full_schema: s.full_schema
      };
    }

    // КОСТЫЛЬ: Если база пустая, подтягиваем локальные JSON-файлы и сохраняем в БД
    if (Object.keys(dict).length === 0) {
      console.warn('⚠️ Схемы в БД не найдены! Загружаю базовые из /struct/editor/ ...');
      const defaultTypes = ['character', 'organization', 'state'];
      for (const type of defaultTypes) {
        try {
          const res = await fetch(`/struct/editor/${type}.json`);
          if (res.ok) {
            const schemaData = await res.json();
            const rustSchema = {
              type_key: type,
              type_name: schemaData.name || type,
              icon: schemaData.iconEmoji || '📄',
              color: schemaData.color || '#444444',
              fields_schema: [],
              full_schema: schemaData
            };
            
            await invoke<{ success: boolean }>('save_entity_schema', {
              project,
              schema: rustSchema
            });

            dict[type] = {
              name: rustSchema.type_name,
              icon: rustSchema.icon,
              full_schema: schemaData
            };
            console.log(`✅ Базовая схема "${type}" успешно сохранена в БД.`);
          }
        } catch (e) {
          console.error(`❌ Ошибка загрузки дефолтной схемы ${type}:`, e);
        }
      }
    }

    return dict;
  },

  getSchemaHistory: (project: string, typeKey: string): Promise<any[]> =>
    invoke<any[]>('get_schema_history', { project, typeKey }),

  toggleSchemaHistoryPin: (historyId: string, isPinned: boolean): Promise<void> =>
    invoke<void>('toggle_schema_history_pin', { historyId, isPinned }),

  saveSchema: (project: string, schema: any, maxSaves?: number): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_entity_schema', { 
      project, 
      schema: {
        project_id: projectRecordId(project),
        ...schema
      },
      maxSaves: maxSaves || 10
    }),

  getConnections: (entityId: string): Promise<ConnectionData[]> =>
    invoke<ConnectionData[]>('get_entity_connections', { entityId }),
    
  saveConnection: (project: string, conn: ConnectionData): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_connection', { project, conn: { ...conn, project_id: projectRecordId(project) } }),
    
  deleteConnection: (id: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_connection', { id }),
};
