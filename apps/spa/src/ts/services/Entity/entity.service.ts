/**
 * @file entity.service.ts
 * @description Core service for Entity Domain
 * @rust-ready ✅ CRUD
 */

import { entityApi } from './entity.api';
import type { EntityData } from './entity.types';

class EntityService {
  async list(project: string, type: string, filterParams: Record<string, unknown> | null = null): Promise<EntityData[]> {
    if (!type) {
      console.error('❌ Error: entityService.list called without type (type = undefined)');
      return [];
    }

    try {
      const data = await entityApi.getEntityList(project, type, filterParams || undefined) as unknown;
      const dataObj = data as Record<string, unknown> | null;
      const plural = type + (type.endsWith('s') ? '' : 's');
      const entities = (dataObj?.[plural] || data || []) as (EntityData | string)[];

      return entities.map(item => {
        if (typeof item === 'string') {
          try { return JSON.parse(item) as EntityData; } catch { return null; }
        }
        return item as EntityData;
      }).filter((item): item is EntityData => item !== null);
    } catch (error) {
      console.error(`Error loading entities ${type}`, error);
      throw error;
    }
  }

  async get(project: string, type: string, id: string): Promise<EntityData> {
    return await entityApi.getEntity(project, type, id) as EntityData;
  }

  async save(project: string, type: string, data: EntityData, id: string | null = null): Promise<{ success: boolean; id?: string }> {
    return await entityApi.saveEntity(project, type, data as Record<string, unknown>, id || undefined, data.name);
  }

  async delete(project: string, type: string, id: string): Promise<{ success: boolean }> {
    return await entityApi.deleteEntity(project, type, id);
  }
}

export const entityService = new EntityService();
