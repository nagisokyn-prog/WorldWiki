import { ref } from 'vue';
import { getValueByPath } from '@/utils/path';

export type SchemaCacheLike = {
  loadSchema: (entityType: string) => Promise<any>;
  getEntityDisplayName: (entity: Record<string, unknown>, entityType?: string) => string;
};

export function useSchemaCache() {
  const schemaCache = ref<Record<string, any>>({});

  const loadSchema = async (entityType: string): Promise<any> => {
    if (schemaCache.value[entityType]) return schemaCache.value[entityType];
    try {
      const res = await fetch(`/struct/editor/${entityType}.json`);
      if (res.ok) schemaCache.value[entityType] = await res.json();
    } catch {}
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
}