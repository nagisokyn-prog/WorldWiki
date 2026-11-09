/**
 * @file entity.api.ts
 * @description API methods for Entity Domain
 */

import { invoke, processIds } from '@worldwiki/components';
import { projectRecordId } from '../api/project.api';
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

  getEntityList: async (project: string, type: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
    const list = await invoke<Record<string, unknown>[]>('get_entities', { project, entityType: type, filters: filters || null });
    return list.map(processIds).map((item: Record<string, unknown>) => {
      if (!item) return item;
      const result = { ...item };
      if (item.attributes && typeof item.attributes === 'object') {
        Object.assign(result, item.attributes);
      }
      if (item.data && typeof item.data === 'object') {
        Object.assign(result, item.data);
      }
      delete result.attributes;
      delete result.data;
      const rawTags = item.tags ?? result.tags ?? result['теги'] ?? [];
      const cleanTags = Array.isArray(rawTags)
        ? rawTags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean)
        : typeof rawTags === 'string'
          ? rawTags.split(',').map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean)
          : [];
      result.tags = cleanTags;
      result['теги'] = cleanTags;

      const resolvedName = (result.name as string) || (result['название'] as string) || '';
      if (resolvedName) {
        result.name = resolvedName;
        result['название'] = resolvedName;
      }

      return result;
    });
  },

  getEntity: async (project: string, type: string, id: string): Promise<Record<string, unknown>> => {
    const detail = await invoke<Record<string, unknown>>('get_entity', { id });
    const processed = processIds(detail);
    if (!processed) return processed;
    
    const result = { ...processed };
    if (processed.attributes && typeof processed.attributes === 'object') {
      Object.assign(result, processed.attributes);
    }
    if (processed.data && typeof processed.data === 'object') {
      Object.assign(result, processed.data);
    }
    delete result.attributes;
    delete result.data;

    // Синхронизация tags <-> теги:
    // SurrealDB возвращает tags: string[] через ребра tagged_with.
    // Схемы сущностей в UI (character.json, location.json и др.) привязаны к path = "теги".
    const rawTags = processed.tags ?? result.tags ?? result['теги'] ?? [];
    const cleanTags = Array.isArray(rawTags)
      ? rawTags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean)
      : typeof rawTags === 'string'
        ? rawTags.split(',').map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean)
        : [];
    result.tags = cleanTags;
    result['теги'] = cleanTags;

    // Синхронизация name <-> название
    const resolvedName = (result.name as string) || (result['название'] as string) || '';
    if (resolvedName) {
      result.name = resolvedName;
      result['название'] = resolvedName;
    }
    
    return result;
  },

  formatEntityPayload: (project: string, type: string, data: Record<string, unknown>, id?: string, name?: string): Record<string, unknown> => {
    const actualData = JSON.parse(JSON.stringify(data));
    let extractedName = name || (actualData['название'] as string) || (actualData.name as string) || 'Новая сущность';

    if (extractedName === 'Новая сущность' || !name) {
      if (actualData['название'] && typeof actualData['название'] === 'string' && (actualData['название'] as string).trim() !== '') {
        extractedName = (actualData['название'] as string).trim();
      } else {
        const keys = Object.keys(actualData).filter(k => k !== 'id' && k !== 'project_id' && k !== 'entity_type' && k !== 'attributes');
        if (keys.length > 0) {
          const firstVal = actualData[keys[0]];
          if (typeof firstVal === 'string' && firstVal.trim() !== '') {
            extractedName = firstVal.trim();
          }
        }
      }
    }

    const SYSTEM_FIELDS = new Set(['id', 'project_id', 'entity_type', 'name', 'description', 'tags', 'теги', 'embedding', 'created_at', 'updated_at', 'attributes']);
    const cleanAttributes: Record<string, unknown> = {};
    for (const k of Object.keys(actualData)) {
      if (!SYSTEM_FIELDS.has(k)) cleanAttributes[k] = actualData[k];
    }

    const rawTags = actualData['теги'] !== undefined && actualData['теги'] !== null
      ? actualData['теги']
      : actualData.tags;
    const cleanTags = Array.isArray(rawTags)
      ? rawTags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean)
      : typeof rawTags === 'string'
        ? rawTags.split(',').map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean)
        : [];

    cleanAttributes['название'] = extractedName;
    cleanAttributes['теги'] = cleanTags;

    return {
      id: id ?? null,
      project_id: projectRecordId(project),
      entity_type: type,
      name: extractedName,
      description: actualData.description || null,
      attributes: cleanAttributes,
      tags: cleanTags,
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
    const list = await invoke<Array<{ type_key: string; type_name?: string; icon?: string; full_schema?: Record<string, unknown> }>>('get_entity_schemas', { project });
    const dict: Record<string, SchemaInfo> = {};
    for (const s of list) {
      dict[s.type_key] = {
        name: s.type_name || s.type_key,
        icon: s.icon || '📄',
        full_schema: s.full_schema
      };
    }

    // Однократная синхронизация и актуализация схем (v2 с полным набором сущностей)
    const defaultTypes = ['character', 'location', 'organization', 'state', 'item', 'event'];
    const syncKey = `worldwiki_schema_sync_v2_${project}`;
    const needsSync = typeof localStorage !== 'undefined' && localStorage.getItem(syncKey) !== 'v2_done';
    const isDbEmpty = Object.keys(dict).length === 0;

    if (needsSync || isDbEmpty) {
      console.log(`🔄 [SchemaSync] Однократная синхронизация базовых схем для проекта "${project}"...`);
      for (const type of defaultTypes) {
        if (dict[type]) {
          continue;
        }
        try {
          const res = await fetch(`/struct/editor/${type}.json`);
          if (res.ok) {
            const schemaData = await res.json();
            const rustSchema = {
              type_key: type,
              type_name: schemaData.name || type,
              icon: schemaData.iconEmoji || '📄',
              color: schemaData.color || 'var(--color-bg-tertiary)',
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
            console.log(`✅ Базовая схема "${type}" успешно синхронизирована в БД.`);
          }
        } catch (e) {
          console.error(`❌ Ошибка синхронизации дефолтной схемы ${type}:`, e);
        }
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(syncKey, 'v2_done');
      }
    } else {
      // Для уже синхронизированных проектов проверяем наличие всех базовых схем
      for (const type of defaultTypes) {
        if (!dict[type]) {
          try {
            const res = await fetch(`/struct/editor/${type}.json`);
            if (res.ok) {
              const schemaData = await res.json();
              const rustSchema = {
                type_key: type,
                type_name: schemaData.name || type,
                icon: schemaData.iconEmoji || '📄',
                color: schemaData.color || 'var(--color-bg-tertiary)',
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
              console.log(`✅ Недостающая базовая схема "${type}" успешно добавлена в БД.`);
            }
          } catch (e) {
            console.error(`❌ Ошибка загрузки схемы ${type}:`, e);
          }
        }
      }
    }

    return dict;
  },

  getSchemaHistory: (project: string, typeKey: string): Promise<Record<string, unknown>[]> =>
    invoke<Record<string, unknown>[]>('get_schema_history', { project, typeKey }),

  toggleSchemaHistoryPin: (historyId: string, isPinned: boolean): Promise<void> =>
    invoke<void>('toggle_schema_history_pin', { historyId, isPinned }),

  saveSchema: (project: string, schema: Record<string, unknown>, maxSaves?: number): Promise<{ success: boolean }> =>
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
