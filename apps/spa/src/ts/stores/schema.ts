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
    const sch = entityType ? schemaCache.value[entityType] : null;
    const firstField = sch?.sections?.[0]?.fields?.[0];
    const rawPath = sch?.titleField || firstField?.path || firstField?.id || firstField?.class;
    const path = typeof rawPath === 'string' && rawPath.trim().length > 0 ? rawPath.trim() : '';
    if (path) {
      const val = getValueByPath(entity, path) ?? (entity.attributes ? getValueByPath(entity.attributes as Record<string, unknown>, path) : undefined);
      if (val && String(val).trim().length > 0) return String(val).trim();
    }
    const explicitName = entity.name || entity.Name || entity.title || (entity['название'] as string);
    if (explicitName && typeof explicitName === 'string' && explicitName.trim().length > 0) {
      return explicitName.trim();
    }
    const attrs = entity.attributes as Record<string, unknown> | undefined;
    if (attrs && typeof attrs === 'object') {
      const attrName = attrs.name || (attrs['название'] as string) || attrs.title || attrs.label;
      if (attrName && typeof attrName === 'string' && attrName.trim().length > 0) {
        return attrName.trim();
      }
    }
    const IGNORED = new Set(['id', 'project_id', 'schema_id', 'entity_type', 'type_key', 'created_at', 'updated_at', 'attributes', 'embedding', 'tags', 'теги']);
    const keys = Object.keys(entity).filter((k) => !IGNORED.has(k));
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