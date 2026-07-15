import { shallowRef } from 'vue';
import { apiService } from '../services/api.service';

export function useEntityLoader(projectName: string, addLog: Function) {
  const entityLists = shallowRef<Record<string, Array<Record<string, unknown>>>>({});
  const chapters = shallowRef<Array<any>>([]);
  const schemaCache: Record<string, any> = {};

  const loadSchema = async (entityType: string): Promise<any> => {
    if (schemaCache[entityType]) return schemaCache[entityType];
    try {
      const res = await fetch(`/struct/editor/${entityType}.json`);
      if (res.ok) { schemaCache[entityType] = await res.json(); }
    } catch {}
    return schemaCache[entityType] || null;
  };

  const getValueByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
  };

  const setValueByPath = (obj: any, path: string, value: any): void => {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  };

  const getEntityDisplayName = (entity: Record<string, unknown>, entityType?: string): string => {
    if (!entity) return 'Без названия';
    
    if (entityType && schemaCache[entityType]) {
      const path = schemaCache[entityType].titleField;
      if (path) {
        const val = getValueByPath(entity, path);
        if (val && String(val).trim().length > 0) {
          return String(val).trim();
        }
      }
    }

    const keys = Object.keys(entity);
    if (keys.length > 0) {
      const firstVal = entity[keys[0]];
      if (typeof firstVal === 'string' && firstVal.trim().length > 0) {
        return firstVal.trim();
      }
    }

    return `[${String(entity.id || 'Unknown').substring(0, 8)}]`;
  };

  const loadEntityList = async (entityType: string) => {
    try {
      await loadSchema(entityType);
      const list = await apiService.getEntityList(projectName, entityType);
      entityLists.value[entityType] = list as Array<Record<string, unknown>>;
      addLog(`Data -> Loaded ${list.length} ${entityType}(s)`, 'info');
    } catch (e) {
      addLog(`Data -> Error loading ${entityType}: ${e}`, 'error');
      entityLists.value[entityType] = [];
    }
  };

  const loadChapters = async () => {
    try {
      const list = await apiService.getChaptersList(projectName);
      chapters.value = (list as Array<any>);
      addLog(`Data -> Loaded ${chapters.value.length} chapter(s)`, 'info');
    } catch (e) {
      addLog(`Data -> Error loading chapters: ${e}`, 'error');
      chapters.value = [];
    }
  };

  return {
    entityLists,
    chapters,
    schemaCache,
    loadSchema,
    getValueByPath,
    setValueByPath,
    getEntityDisplayName,
    loadEntityList,
    loadChapters
  };
}
