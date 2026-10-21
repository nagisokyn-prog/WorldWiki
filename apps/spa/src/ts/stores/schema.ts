/**
 * @file schema.ts
 * @description Pinia store для кеша схем сущностей
 */
import { defineStore } from 'pinia';
import { onScopeDispose, ref } from 'vue';
import { getValueByPath } from '@/utils/path';

export interface EntitySchema {
  titleField?: string;
  type_key?: string;
  full_schema?: EntitySchema;
  sections?: Array<{
    title?: string;
    fields?: Array<{ path: string; isTitle?: boolean; [key: string]: unknown }>;
    dynamicContainers?: Array<{ id?: string; template?: string; dataPath?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export const useSchemaStore = defineStore('schema', () => {
  const schemaCache = ref<Record<string, EntitySchema>>({});

  const loadSchema = async (entityType: string): Promise<EntitySchema | null> => {
    if (schemaCache.value[entityType]) return schemaCache.value[entityType];
    try {
      const { useShellStore } = await import('@/stores/shell');
      const project = useShellStore().projectName;
      const api = await import('@/services/api.client');
      const schemas = await api.getEntitySchemas(project);
      const foundSchema = schemas.find((s) => s.type_key === entityType) as EntitySchema | undefined;
      
      if (foundSchema && foundSchema.full_schema) {
        const parsed = foundSchema.full_schema;
        if (parsed?.sections) {
          parsed.sections.forEach((sec) => {
            if (sec.dynamicContainers) {
              sec.dynamicContainers.forEach((dc, idx) => {
                if (!dc.id) dc.id = dc.template ? `dyn_${dc.template}` : `dyn_${idx}`;
                if (!dc.dataPath) dc.dataPath = dc.id;
              });
            }
          });
        }
        schemaCache.value[entityType] = parsed;
      } else {
        const staticTypes = ['character', 'location', 'organization', 'state', 'item', 'event', 'fraction', 'ui_editor'];
        if (staticTypes.includes(entityType)) {
          const res = await fetch(`/struct/editor/${entityType}.json`);
          if (res.ok) schemaCache.value[entityType] = await res.json() as EntitySchema;
        }
      }
    } catch (e) {
      console.warn('[schema store] failed to load schema for', entityType, e);
    }
    return schemaCache.value[entityType] || null;
  };

  const getEntityDisplayName = (entity: Record<string, unknown>, entityType?: string): string => {
    if (!entity) return 'Без названия';
    if (entityType === 'planet' || entityType === 'calendar') {
      const explicitName = entity.name || entity.Name || entity.title || entity.название;
      if (explicitName && typeof explicitName === 'string' && explicitName.trim().length > 0) {
        return explicitName.trim();
      }
    }
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

  const invalidateSchema = (entityType?: string) => {
    if (entityType) {
      delete schemaCache.value[entityType];
    } else {
      schemaCache.value = {};
    }
  };

  if (typeof window !== 'undefined') {
    const handleSchemaUpdated = ((e: CustomEvent<{ entityType?: string }>) => {
      invalidateSchema(e.detail?.entityType);
    }) as EventListener;

    window.addEventListener('ww:schema-updated', handleSchemaUpdated);
    onScopeDispose(() => {
      window.removeEventListener('ww:schema-updated', handleSchemaUpdated);
    });
  }

  return {
    schemaCache,
    loadSchema,
    getEntityDisplayName,
    invalidateSchema,
  };
});