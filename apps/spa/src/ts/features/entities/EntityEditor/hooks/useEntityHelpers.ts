import { ref } from 'vue';
import { apiService } from '../../../../services/api.service';

export function useEntityHelpers(formData: any, config: any) {
  const photoUrlCache = ref<Record<string, string>>({});
  
  const getPhotoUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) return path;
    if (photoUrlCache.value[path]) return photoUrlCache.value[path];
    
    apiService.getLocalPhotoUrl(path).then(url => {
      photoUrlCache.value[path] = url;
    });
    return '';
  };

  const getProp = (obj: any, path?: any) => {
    if (path === undefined) {
      path = obj;
      obj = formData.value;
    }
    if (!path) return '';
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) return '';
      current = current[parts[i]];
    }
    return current;
  };

  const setProp = (obj: any, path: any, val?: any) => {
    if (val === undefined) {
      val = path;
      path = obj;
      obj = formData.value;
    }
    if (!path) return;
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined || current[parts[i]] === null) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = val;
  };

  const getResolvedTemplate = (container: any) => {
    let baseTpl: any = null;
    if (container.fields && !container.template) {
      baseTpl = container;
    } else {
      baseTpl = config.value?.templates?.[container.template];
    }
    if (!baseTpl) return null;
    
    let resolvedFields = baseTpl.fields || [];
    if (container.fieldOverrides) {
      resolvedFields = resolvedFields.map((f: any) => {
        const override = container.fieldOverrides[f.class];
        if (override) {
          if (override.hidden) return null;
          return { ...f, ...override };
        }
        return f;
      }).filter(Boolean);
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

  const isAtomicField = (item: any) => {
    return atomicBricks.some(b => b.val === item.type) || item.type === 'tags' || item.type === 'range';
  };

  return {
    getPhotoUrl,
    getProp,
    setProp,
    getResolvedTemplate,
    isAtomicField
  };
}
