import { ref } from 'vue';
import type { Ref } from 'vue';
import type { SchemaConfig, DynamicContainer, SchemaField } from '../EntityEditor.model';

export function useEntityHelpers(
  formData: Ref<Record<string, unknown>>,
  config: Ref<SchemaConfig | null>
) {
  const photoUrlCache = ref<Record<string, string>>({});
  
  const getPhotoUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http') || path.startsWith('asset:') || path.startsWith('tauri:')) return path;
    if (photoUrlCache.value[path]) return photoUrlCache.value[path];
    
    try {
      const w = typeof window !== 'undefined' ? (window as unknown as { __TAURI__?: { core?: { convertFileSrc?: (p: string) => string }; convertFileSrc?: (p: string) => string }; __TAURI_INTERNALS__?: { convertFileSrc?: (p: string) => string } }) : null;
      if (w?.__TAURI__?.core?.convertFileSrc) {
        const converted = w.__TAURI__.core.convertFileSrc(path);
        photoUrlCache.value[path] = converted;
        return converted;
      } else if (w?.__TAURI__?.convertFileSrc) {
        const converted = w.__TAURI__.convertFileSrc(path);
        photoUrlCache.value[path] = converted;
        return converted;
      } else if (w?.__TAURI_INTERNALS__?.convertFileSrc) {
        const converted = w.__TAURI_INTERNALS__.convertFileSrc(path);
        photoUrlCache.value[path] = converted;
        return converted;
      }
    } catch (e) {
      console.warn('[useEntityHelpers] convertFileSrc error:', e);
    }

    Promise.resolve(path).then(url => {
      photoUrlCache.value[path] = url;
    });
    return path;
  };

  const getProp = (objOrPath: unknown, maybePath?: string): unknown => {
    let path: string;
    let obj: unknown;
    if (maybePath === undefined) {
      path = typeof objOrPath === 'string' ? objOrPath : '';
      obj = formData.value;
    } else {
      path = maybePath;
      obj = objOrPath;
    }
    if (!path) return '';
    const parts = path.split('.');
    let current: unknown = obj;
    for (let i = 0; i < parts.length; i++) {
      if (current === undefined || current === null || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[parts[i]];
    }
    return current;
  };

  const setProp = (objOrPath: unknown, pathOrVal: unknown, maybeVal?: unknown) => {
    let path: string;
    let obj: Record<string, unknown>;
    let val: unknown;
    if (maybeVal === undefined) {
      val = pathOrVal;
      path = typeof objOrPath === 'string' ? objOrPath : '';
      obj = formData.value;
    } else {
      val = maybeVal;
      path = typeof pathOrVal === 'string' ? pathOrVal : '';
      obj = (objOrPath && typeof objOrPath === 'object' ? objOrPath : formData.value) as Record<string, unknown>;
    }
    if (!path) return;
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined || current[parts[i]] === null || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = val;
  };

  const getResolvedTemplate = (container: DynamicContainer & { fields?: SchemaField[] }) => {
    let baseTpl: { fields?: SchemaField[]; dynamicContainers?: DynamicContainer[] } | undefined;
    if (container.fields && !container.template) {
      baseTpl = container;
    } else if (container.template) {
      baseTpl = config.value?.templates?.[container.template];
    }
    if (!baseTpl) return null;
    
    let resolvedFields = baseTpl.fields || [];
    if (container.fieldOverrides) {
      const overrides = container.fieldOverrides as Record<string, Partial<SchemaField>>;
      resolvedFields = resolvedFields.map((f: SchemaField) => {
        const override = f.class ? overrides[f.class] : undefined;
        if (override) {
          if (override.hidden) return null;
          return { ...f, ...override };
        }
        return f;
      }).filter((f): f is SchemaField => f !== null);
    }
    return { ...baseTpl, fields: resolvedFields };
  };

  const atomicBricks = [
    { val: 'text', label: 'Текст (Короткий)' },
    { val: 'textarea', label: 'Текст (Многострочный)' },
    { val: 'number', label: 'Число' },
    { val: 'select', label: 'Выбор (Один)' },
    { val: 'multiselect', label: 'Выбор (Множество)' },
    { val: 'photo', label: 'Фото/Изображение' },
    { val: 'calendar_date', label: 'Дата (Календарь Мира)' },
    { val: 'calendar_date_base', label: 'Дата (Базовая)' },
    { val: 'boolean', label: 'Да/Нет (Чекбокс)' },
    { val: 'tags', label: 'Теги' },
    { val: 'range', label: 'Ползунок (Range)' }
  ];

  const isAtomicField = (item: { type?: string } | null | undefined) => {
    if (!item) return false;
    return atomicBricks.some(b => b.val === item.type) || item.type === 'tags' || item.type === 'range';
  };

  return {
    getPhotoUrl,
    getProp,
    setProp,
    getResolvedTemplate,
    isAtomicField,
    photoUrlCache
  };
}
