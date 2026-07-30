/**
 * @file schema.ts
 * @description Pinia store для кеша схем сущностей
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getValueByPath } from '@/utils/path';

export interface EntitySchema {
  titleField?: string;
  sections?: Array<{
    title: string;
    fields: Array<{ path: string; isTitle?: boolean }>;
  }>;
}

export const useSchemaStore = defineStore('schema', () => {
  const schemaCache = ref<Record<string, any>>({});

  const loadSchema = async (entityType: string): Promise<any> => {
    if (schemaCache.value[entityType]) return schemaCache.value[entityType];
    try {
      const { useShellStore } = await import('@/stores/shell');
      const project = useShellStore().projectName;
      const api = await import('@/services/api.client');
      const schemas = await api.getEntitySchemas(project);
      const foundSchema = schemas.find((s: any) => s.type_key === entityType);
      
      if (foundSchema && foundSchema.full_schema) {
        const parsed = foundSchema.full_schema;
        if (parsed?.sections) {
          parsed.sections.forEach((sec: any) => {
            if (sec.dynamicContainers) {
              sec.dynamicContainers.forEach((dc: any, idx: number) => {
                if (!dc.id) dc.id = dc.template ? `dyn_${dc.template}` : `dyn_${idx}`;
                if (!dc.dataPath) dc.dataPath = dc.id;
              });
            }
          });
        }
        schemaCache.value[entityType] = parsed;
      } else {
        const staticTypes = ['character', 'location', 'event', 'fraction', 'item', 'ui_editor'];
        if (staticTypes.includes(entityType)) {
          const res = await fetch(`/struct/editor/${entityType}.json`);
          if (res.ok) schemaCache.value[entityType] = await res.json();
        }
      }
    } catch (e) {
      console.warn('[schema store] failed to load schema for', entityType, e);
    }
    return schemaCache.value[entityType] || null;
  };

  const getEntityDisplayName = (entity: Record<string, unknown>, entityType?: string): string => {
    if (!entity) return 'Без названия';
    if (entityType && schemaCache.value[entityType]) {
      const path = schemaCache.value[entityType].titleField;
      if (path) {
        const val = getValueByPath(entity, path);
        if (val && String(val).trim().length > 0) return String(val).trim();
      }
    }
    const keys = Object.keys(entity);
    if (keys.length > 0) {
      const firstVal = entity[keys[0]];
      if (typeof firstVal === 'string' && firstVal.trim().length > 0) return firstVal.trim();
    }
    return `[${String(entity.id || 'Unknown').substring(0, 8)}]`;
  };

  return {
    schemaCache,
    loadSchema,
    getEntityDisplayName,
  };
});