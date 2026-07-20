/**
 * @file entity.api.ts
 * @description API-методы для работы с сущностями и схемами
 */

import { invoke, processIds } from '@worldwiki/components';
import { projectRecordId } from './project.api';

export interface EntityData {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SchemaInfo {
  name: string;
  icon: string;
  [key: string]: unknown;
}

export interface EntityType {
  type: string;
  name: string;
  iconEmoji: string;
}

export const entityApi = {
  getEntityList: async (project: string, type: string, filters?: Record<string, unknown>): Promise<EntityData[]> => {
    const list = await invoke<any[]>('get_entities', { project, entityType: type, filters });
    return list.map(processIds).map((item: any) => {
      if (item && item.data && typeof item.data === 'object') {
        return { ...item.data, id: item.id };
      }
      return item;
    });
  },

  getEntity: async (project: string, type: string, id: string): Promise<any> => {
    const detail: any = await invoke<any>('get_entity', { id });
    const processed: any = processIds(detail);
    // Всегда возвращаем раскрытые атрибуты (без обертки в attributes)
    if (processed && processed.attributes && typeof processed.attributes === 'object') {
      return { ...processed.attributes, id: processed.id };
    }
    if (processed && processed.data && typeof processed.data === 'object') {
      return { ...processed.data, id: processed.id };
    }
    return processed;
  },

  saveEntity: (project: string, type: string, data: any, id?: string, explicitName?: string): Promise<{ success: boolean; id?: string }> => {
    let extractedName = explicitName || 'Без названия';

    const actualData = data.attributes && !data.Name && !data.name && Object.keys(data).length === 1 && typeof data.attributes === 'object'
      ? data.attributes
      : data;

    if (extractedName === 'Без названия' && actualData && typeof actualData === 'object') {
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

    const entity = {
      id: (id && id !== 'undefined' && id !== '') ? id : null,
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

  toggleEntityHistoryPin: (historyId: string, isPinned: boolean): Promise<void> =>
    invoke<void>('toggle_entity_history_pin', { historyId, isPinned }),

  getSchemas: async (project: string): Promise<Record<string, SchemaInfo>> => {
    const list = await invoke<any[]>('get_entity_schemas', { project });
    const map: Record<string, SchemaInfo> = {};
    for (const item of list) {
      map[item.type_key] = { name: item.type_name, icon: item.icon, full_schema: item.full_schema };
    }
    return map;
  },

  saveSchema: (project: string, schema: any, maxSaves?: number): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_entity_schema', { project, schema, maxSaves }),

  getSchemaHistory: (project: string, typeKey: string): Promise<any[]> =>
    invoke<any[]>('get_schema_history', { project, typeKey }),

  toggleSchemaHistoryPin: (historyId: string, isPinned: boolean): Promise<void> =>
    invoke<void>('toggle_schema_history_pin', { historyId, isPinned }),

  getEntityTypes: async (project: string): Promise<EntityType[]> => {
    const schemas = await entityApi.getSchemas(project);
    return Object.entries(schemas).map(([key, schema]) => ({
      type: key,
      name: schema.name || key,
      iconEmoji: schema.icon || '📄'
    }));
  },
};