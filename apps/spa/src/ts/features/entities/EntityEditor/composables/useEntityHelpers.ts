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

    // Если значение первого поля сущности (по позиции в схеме) пустое, но есть системное имя (name)
    if ((current === undefined || current === null || current === '') && obj === formData.value) {
      const firstSection = config.value?.sections?.[0];
      const firstField = firstSection?.fields?.[0];
      const firstFieldPath = firstField?.path || firstField?.id || firstField?.class || config.value?.titleField;
      if (firstFieldPath && firstFieldPath === path) {
        const entityName = (formData.value as Record<string, unknown>)?.name;
        if (entityName !== undefined && entityName !== null && entityName !== '') {
          return entityName;
        }
      }
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

    // Синхронизируем name, если редактируется первое поле схемы по позиции
    const firstSection = config.value?.sections?.[0];
    const firstField = firstSection?.fields?.[0];
    const firstFieldPath = firstField?.path || firstField?.id || firstField?.class || config.value?.titleField;
    if (firstFieldPath && firstFieldPath === path && obj === formData.value) {
      (formData.value as Record<string, unknown>).name = val;
    }
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

  const getResolvedTemplate = (container: DynamicContainer): DynamicContainer | null => {
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
    return {
      ...container,
      ...baseTpl,
      dataPath: container.dataPath || (baseTpl as { dataPath?: string }).dataPath,
      id: container.id || (baseTpl as { id?: string }).id || '',
      fields: resolvedFields
    };
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

  const getDynamicList = (pathOrContainer: string | DynamicContainer): Array<Record<string, unknown>> => {
    const path = typeof pathOrContainer === 'string'
      ? pathOrContainer
      : (pathOrContainer.dataPath || pathOrContainer.id || '');
    if (!path) return [];
    const raw = getProp(path);
    if (Array.isArray(raw)) {
      return raw as Array<Record<string, unknown>>;
    }
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
      return [raw as Record<string, unknown>];
    }
    return [];
  };

  const getItemSummary = (item: Record<string, unknown>, container: DynamicContainer): string => {
    if (!item || typeof item !== 'object') return '';
    const resolved = getResolvedTemplate(container);
    const fields = resolved?.fields || [];
    for (const f of fields) {
      const key = f.id || f.class || '';
      const val = item[key];
      if (val !== undefined && val !== null && val !== '') {
        if (typeof val === 'string' && val.trim().length > 0) return val.trim();
        if (typeof val === 'number') return String(val);
        if (typeof val === 'object' && !Array.isArray(val)) {
          const pt = val as { chapter_id?: string; title?: string };
          if (pt.title) return pt.title;
          if (pt.chapter_id) return `Глава: ${pt.chapter_id}`;
          const dt = val as { год?: number; название?: string };
          if (dt.год !== undefined) return `${dt.год} г.`;
          if (dt.название) return dt.название;
        }
      }
    }
    return '';
  };

  const getFieldLabel = (key: string): string => {
    for (const sec of config.value?.sections || []) {
      const f = sec.fields?.find(field => (field.path || field.id || field.class) === key);
      if (f) return f.label;
    }
    return key;
  };

  const getContainerTitle = (key: string): string => {
    for (const sec of config.value?.sections || []) {
      const c = sec.dynamicContainers?.find(dc => (dc.dataPath || dc.id) === key);
      if (c) return c.title || key;
    }
    return key;
  };

  return {
    getPhotoUrl,
    getProp,
    setProp,
    getDynamicList,
    getResolvedTemplate,
    getItemSummary,
    getFieldLabel,
    getContainerTitle,
    isAtomicField,
    photoUrlCache
  };
}
