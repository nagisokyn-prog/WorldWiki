/**
 * @file entity.service.ts
 * @description Сервис для работы с сущностями
 * @rust-ready ✅ CRUD сущностей
 */

import { apiService } from './api.service';

interface EntityData {
  id: string;
  name: string;
  [key: string]: unknown;
}

class EntityService {
  async list(project: string, type: string, filterParams: Record<string, unknown> | null = null): Promise<EntityData[]> {
    if (!type) {
      console.error('❌ Ошибка: entityService.list вызван без типа (type = undefined)');
      return [];
    }

    try {
      const data = await apiService.getEntityList(project, type, filterParams || undefined) as unknown;
      const dataObj = data as Record<string, unknown> | null;
      const plural = type + (type.endsWith('s') ? '' : 's');
      let entities = (dataObj?.[plural] || data || []) as (EntityData | string)[];

      return entities.map(item => {
        if (typeof item === 'string') {
          try { return JSON.parse(item) as EntityData; } catch { return null; }
        }
        return item as EntityData;
      }).filter((item): item is EntityData => item !== null);
    } catch (error) {
      console.error(`Ошибка загрузки сущностей ${type}`, error);
      throw error;
    }
  }

  async get(project: string, type: string, id: string): Promise<EntityData> {
    return await apiService.getEntity(project, type, id) as EntityData;
  }

  async save(project: string, type: string, data: EntityData, id: string | null = null): Promise<{ success: boolean }> {
    return await apiService.saveEntity(project, type, data, id || undefined, data.name);
  }

  async delete(project: string, type: string, id: string): Promise<{ success: boolean }> {
    return await apiService.deleteEntity(project, type, id);
  }
}

export const entityService = new EntityService();

declare global {
  interface Window {
    entityService: EntityService;
  }
}

if (typeof window !== 'undefined') {
  window.entityService = entityService;
}