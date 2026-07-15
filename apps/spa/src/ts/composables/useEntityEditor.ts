import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import { apiService } from '../../services/api.service';
import { settingsService } from '@worldwiki/components';

export function useEntityEditor(props: any, emit: any) {

const loading = ref(true);
const isInitializing = ref(false); 
const config = shallowRef<any>(null);
const formData = ref<any>({});
const lastEmittedData = ref<any>(null);
const foreignUpdates = ref<any>({});
const activeSection = ref('');
const referenceData = shallowRef<any>({});
const photoInputs: any = {};
const hoverState = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);

// История версий
const showHistory = ref(false);
const isLoadingHistory = ref(false);
const revisions = shallowRef<any[]>([]);
const isPreviewingHistory = ref(false);
const previewingRevId = ref<string | null>(null);
const currentSavedData = shallowRef<any>(null);

const maxSaves = ref(30);

const togglePin = async (rev: any) => {
  const newStatus = !rev.is_pinned;
  try {
    await apiService.toggleEntityHistoryPin(rev.id, newStatus);
    rev.is_pinned = newStatus;
  } catch (e) {
    console.error('Ошибка при пине ревизии:', e);
  }
};

const loadHistory = async () => {
  console.log(`[EntityEditor.vue] loadHistory called for project=`, props.project, ` entityId=`, props.entityId);
  if (!props.project || !props.entityId || !(window as any).__TAURI__) {
    console.warn(`[EntityEditor.vue] loadHistory aborted due to missing props or TAURI`);
    return;
  }
  isLoadingHistory.value = true;
  try {
    console.log(`[EntityEditor.vue] invoking get_entity_revisions...`);
    const rawRevisions = await (window as any).__TAURI__.core.invoke('get_entity_revisions', {
      project: props.project,
      entityId: props.entityId
    }) || [];
    revisions.value = rawRevisions.map((rev: any) => ({
      ...rev,
      formattedDate: new Date(rev.created_at).toLocaleString()
    }));
    console.log(`[EntityEditor.vue] get_entity_revisions returned formatted:`, revisions.value);
  } catch (e) {
    console.error('Ошибка загрузки истории:', e);
  } finally {
    isLoadingHistory.value = false;
  }
};

const toggleHistory = () => {
  showHistory.value = !showHistory.value;
  if (showHistory.value && revisions.value.length === 0) {
    loadHistory();
  }
};

const previewHistory = (rev: any) => {
  if (!isPreviewingHistory.value) {
    // Сохраняем текущие данные редактора, чтобы можно было отменить
    currentSavedData.value = JSON.parse(JSON.stringify(formData.value));
  }
  isPreviewingHistory.value = true;
  previewingRevId.value = rev.id;
  
  console.log('[EntityEditor] previewHistory rev:', rev);
  console.log('[EntityEditor] previewHistory rev.content:', rev.content);
  console.log('[EntityEditor] previewHistory rev.content.attributes:', rev.content?.attributes);
  console.log('[EntityEditor] previewHistory rev.content.data:', rev.content?.data);

  // Подменяем данные в форме. Данные сущности лежат в rev.content.attributes или rev.content.data
  formData.value = JSON.parse(JSON.stringify(rev.content?.attributes || rev.content?.data || rev.content || {}));
};

const exitHistoryPreview = () => {
  if (currentSavedData.value) {
    formData.value = JSON.parse(JSON.stringify(currentSavedData.value));
  }
  isPreviewingHistory.value = false;
  previewingRevId.value = null;
  currentSavedData.value = null;
};

const restoreHistory = () => {
  isPreviewingHistory.value = false;
  previewingRevId.value = null;
  currentSavedData.value = null;
  // Помечаем форму как измененную
  emit('modified');
  lastEmittedData.value = null; 
  markModified();
};

const getDiffSummary = (current: any, previous: any) => {
  if (!previous) return '';
  const currData = current.content?.attributes || current.content?.data || current.content || {};
  const prevData = previous.content?.attributes || previous.content?.data || previous.content || {};
  
  const changes = [];
  
  // Проверяем измененные/добавленные поля
  for (const key of Object.keys(currData)) {
    const cVal = JSON.stringify(currData[key]);
    const pVal = JSON.stringify(prevData[key]);
    if (cVal !== pVal) {
      if (!prevData[key] && currData[key]) {
        changes.push(`<span style="color: #10b981;">+ ${key}</span>`);
      } else {
        changes.push(`<span style="color: #f5a623;">~ ${key}</span>`);
      }
    }
  }
  
  // Проверяем удаленные поля
  for (const key of Object.keys(prevData)) {
    if (!(key in currData)) {
      changes.push(`<span style="color: #ef4444;">- ${key}</span>`);
    }
  }
  
  if (changes.length === 0) return 'Без изменений';
  return changes.join(', ');
};
const isFieldChanged = (path: string) => {
  if (!isPreviewingHistory.value || !currentSavedData.value) return false;
  const currentVal = path.split('.').reduce((obj: any, key: string) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, currentSavedData.value);
  const historyVal = getProp(path);
  return JSON.stringify(currentVal) !== JSON.stringify(historyVal);
};

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
    }).filter((f: any) => f !== null);
  }
  
  let resolvedChildContainers = baseTpl.dynamicContainers;
  if (container.customChildContainers) {
    resolvedChildContainers = container.customChildContainers;
  }
  
  return {
    ...baseTpl,
    fields: resolvedFields,
    dynamicContainers: resolvedChildContainers
  };
};

const loadConfigAndData = async () => {
  loading.value = true;
  isInitializing.value = true; // запрещаем dirty во время загрузки
  try {
    // 0. Check for sandbox preview injection
    const sandboxConfig = sessionStorage.getItem('sandbox_preview_config');
    if (props.entityId === 'preview' && sandboxConfig) {
      console.log('[EntityEditor] 🛠️ Using Sandbox Preview Config from sessionStorage');
      config.value = JSON.parse(sandboxConfig);
    } else {
      // 1. Try to load config from DB first
      const schemas = await apiService.getSchemas(props.project);
      if (schemas[props.entityType] && schemas[props.entityType].full_schema) {
        config.value = schemas[props.entityType].full_schema;
      } else {
        // 2. Fallback to file
        const res = await fetch(`/struct/editor/${props.entityType}.json`);
        if (res.ok) {
          config.value = await res.json();
        }
      }
    }

    // 3. Load global templates from ui_editor.json
    try {
      const uiRes = await fetch('/struct/editor/ui_editor.json');
      if (uiRes.ok) {
        const uiData = await uiRes.json();
        if (!config.value.templates) {
          config.value.templates = {};
        }
        if (uiData.templates) {
          Object.assign(config.value.templates, uiData.templates);
        }
      }
    } catch (e) {
      console.warn('[EntityEditor] Failed to load ui_editor.json templates', e);
    }

     // Ensure a section is selected after config is loaded
     console.log(`[EntityEditor.vue ${props.entityId}] config loaded. initialSection prop is:`, props.initialSection);
     if (config.value && config.value.sections && config.value.sections.length > 0) {
       if (props.initialSection && config.value.sections.some((s: any) => s.id === props.initialSection)) {
         activeSection.value = props.initialSection;
         console.log(`[EntityEditor.vue ${props.entityId}] Applied initialSection:`, props.initialSection);
       } else {
         activeSection.value = config.value.sections[0].id;
         console.log(`[EntityEditor.vue ${props.entityId}] initialSection not found or empty. Using default:`, activeSection.value);
       }
       // Emit initial section change so parent can react if needed
       emit('section-change', activeSection.value);
     }
    
    formData.value = JSON.parse(JSON.stringify(props.initialData));
    foreignUpdates.value = {}; 
    
    lastEmittedData.value = JSON.stringify({ ...formData.value, __foreignUpdates: {} });
    
    await loadReferenceData();
    
  } catch (e) {
    console.error('[EntityEditor] Error loading:', e);
  } finally {
    await nextTick();
    loading.value = false;
    isInitializing.value = false;

    // Restore scroll position
    if (props.initialScrollPos > 0) {
      setTimeout(() => {
        if (scrollContainer.value) scrollContainer.value.scrollTop = props.initialScrollPos;
      }, 100);
    }
    
    // Add scroll listener
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', (e: any) => {
          emit('scroll-change', e.target.scrollTop);
        });
      }
    });
  }
};

// In case config loads after component mount and activeSection is still empty,
// ensure we set a default section to trigger rendering.
watch(() => config.value, (newConfig) => {
  if (newConfig && newConfig.sections && newConfig.sections.length > 0 && !activeSection.value) {
    if (props.initialSection && newConfig.sections.some((s: any) => s.id === props.initialSection)) {
      activeSection.value = props.initialSection;
    } else {
      activeSection.value = newConfig.sections[0].id;
    }
    emit('section-change', activeSection.value);
  }
});

const loadReferenceData = async () => {
  const typesToLoad = new Set<string>();
  const scanFields = (fields: any[]) => {
    if (!fields) return;
    fields.forEach((f: any) => {
      if ((f.type === 'select' || f.type === 'multiselect') && f.entityType) typesToLoad.add(f.entityType);
    });
  };
  
  if (config.value && config.value.sections) {
    config.value.sections.forEach((s: any) => {
      scanFields(s.fields);
      if(s.dynamicContainers) {
        s.dynamicContainers.forEach((c: any) => {
          const resolvedTpl = getResolvedTemplate(c);
          if (resolvedTpl) {
            scanFields(resolvedTpl.fields);
            if (resolvedTpl.dynamicContainers) {
              resolvedTpl.dynamicContainers.forEach((nested: any) => {
                const nTpl = getResolvedTemplate(nested);
                if (nTpl) scanFields(nTpl.fields);
              });
            }
          }
        });
      }
    });
  }
  
  const newRefData: any = { ...referenceData.value };
  
  for (const type of typesToLoad) {
    try {
      let list = [];
      if (type === 'chapter') {
        list = await apiService.getChaptersList(props.project);
      } else {
        list = await apiService.getEntityList(props.project, type);
      }

      let titleField = null;
      if (type !== 'chapter') {
        try {
          const res = await fetch(`/struct/editor/${type}.json`);
          if (res.ok) {
            const schema = await res.json();
            titleField = schema.titleField;
          }
        } catch(e) {}
      }
      
      const getValueByPath = (obj: any, path: string): any => {
        if (!path) return undefined;
        return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
      };

      const mappedList = list.map((item: any) => {
        if (titleField) {
          const val = getValueByPath(item, titleField);
          if (val && String(val).trim().length > 0) {
            return { value: String(item.id), label: String(val).trim() };
          }
        }

        let title = item.Name || item.name || item.название;
        
        if (!title) title = `[${String(item.id).substring(0,8)}]`;

        return {
          value: String(item.id),
          label: String(title).trim()
        };
      });
      
      if (type === 'chapter' && list.length > 0) {
        const latestChapter = list[list.length - 1];
        mappedList.unshift({ 
          value: String(latestChapter.id), 
          label: '➡️ Текущая (Автопродление)' 
        });
      }
      
      newRefData[type] = mappedList;
    } catch(e) {
      console.error(`[EntityEditor] Error loading reference data for ${type}:`, e);
      newRefData[type] = [];
    }
  }
  referenceData.value = newRefData;
};

const getOptionsFor = (field: any) => {
  if (field.options && field.options.length > 0) return field.options;
  if (field.entityType && referenceData.value[field.entityType]) {
    return referenceData.value[field.entityType];
  }
  return [];
};

const markModified = () => {
  if (isInitializing.value) return; // программная загрузка — не dirty
  console.log('[EntityEditor.vue] 📤 markModified вызвана');
  nextTick(() => {
    _doMarkModified();
  });
};

const _doMarkModified = () => {
  // 🔴 ВАЖНО: НЕ используем JSON.parse(JSON.stringify) - это теряет изменения!
  // Компоненты динамических списков редактируют объекты через прямые ссылки на объекты
  // Отправляем formData.value напрямую - это Proxy который отслеживает все изменения
  
  const dataWithForeignUpdates = {
    ...formData.value,
    __foreignUpdates: foreignUpdates.value
  };
  
  // Лог для отладки
  console.log('[EntityEditor.vue] 📨 markModified отправляет update-data');
  
  // 🔴 GUARD: Не отправляем если данные идентичны
  const serialized = JSON.stringify(dataWithForeignUpdates);
  
  if (lastEmittedData.value === serialized) {
    console.log('[EntityEditor.vue] ⏭️  Пропускаю emit - данные не изменились');
    return;
  }
  
  console.log('[EntityEditor.vue] ✅ Отправляю update-data - данные изменились!');
  lastEmittedData.value = serialized;
  emit('update-data', dataWithForeignUpdates);
  
  // Также уведомляем родителя что данные изменены (для отметки как "с изменениями")
  emit('modified');
};

// Обработка обновлений "чужой" стороны связи (для сохранения потом)
const handleForeignUpdate = ({ entityType, entityId, data, linkClass, backLinkValue }: any) => {
  if (!entityType || !entityId) return;
  const key = `${entityType}:${entityId}`;
  console.log('[EntityEditor.vue] 🔄 handleForeignUpdate сохраняет данные:', { key, entityType, entityId, dataKeys: Object.keys(data) });
  foreignUpdates.value[key] = { entityType, entityId, data, linkClass, backLinkValue };
  console.log('[EntityEditor.vue] 🔄 foreignUpdates.value ключи обновлены:', Object.keys(foreignUpdates.value));
  
  // ВАЖНО: Вызываем markModified, чтобы прокинуть __foreignUpdates наверх в app.ts
  markModified();
};

const addDynamicItem = (path: any, templateId: any) => {
  if (!getProp(path) || !Array.isArray(getProp(path))) setProp(path, []);
  
  const newItem: any = {};
  const tpl = (config.value as any).templates?.[templateId as string];
  if (tpl && tpl.fields) {
    tpl.fields.forEach((f: any) => {
      newItem[(f.id || f.class) as string] = '';
    });
  }
  
  getProp(path).push(newItem);
  markModified();
};

const removeDynamicItem = (path: any, idx: any) => {
  if(confirm('Удалить элемент?')) {
    getProp(path).splice(idx, 1);
    markModified();
  }
};


const triggerPhotoUpload = (path: any) => {
  photoInputs[path]?.click();
};

const handlePhotoFile = async (e: any, path: string) => {
  const file = (e.target as any).files?.[0];
  if (!file) return;
  try {
    const savedPath = await apiService.uploadPhoto(file);
    setProp(path, savedPath);
    markModified();
  } catch (err) {
    console.error('Failed to upload photo:', err);
  }
};

const handlePhotoDrop = async (e: any, path: string) => {
  const file = e.dataTransfer.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const savedPath = await apiService.uploadPhoto(file);
    setProp(path, savedPath);
    markModified();
  } catch (err) {
    console.error('Failed to upload photo:', err);
  }
};

const removePhoto = (path: string) => {
  setProp(path, '');
  if (photoInputs[path]) photoInputs[path].value = '';
  markModified();
};

watch(() => props.entityId, () => {
  loadConfigAndData();
});

// Синхронизация данных из других сплитов
watch(() => props.initialData, (newVal) => {
  if (isInitializing.value) return;
  // Чтобы не перезаписать локальные изменения и не сбросить курсор, 
  // используем глубокий merge, как и в app.ts
  const merge = (target: any, source: any) => {
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        merge(target[key], source[key]);
      } else if (Array.isArray(source[key])) {
        if (!Array.isArray(target[key])) target[key] = [];
        for (let i = 0; i < source[key].length; i++) {
          if (i < target[key].length) {
            if (typeof source[key][i] === 'object' && source[key][i] !== null) {
              merge(target[key][i], source[key][i]);
            } else {
              target[key][i] = source[key][i];
            }
          } else {
            target[key].push(source[key][i]);
          }
        }
        target[key].length = source[key].length;
      } else {
        target[key] = source[key];
      }
    }
  };
  
  // Отключаем на секунду отправку update-data, чтобы не было бесконечного цикла (эхо)
  const previousState = lastEmittedData.value;
  // ВАЖНО: Не перезаписываем массивы связей через merge из initialData!
  // Эти массивы редактируются напрямую через компоненты списков (по ссылке на объекты formData).
  // Собираем пути динамических контейнеров из схемы, чтобы исключить их из merge.
  const skipKeys = new Set(['__foreignUpdates']);
  if (config.value && config.value.sections) {
    for (const sec of config.value.sections) {
      if (sec.dynamicContainers) {
        for (const dc of sec.dynamicContainers) {
          const path = dc.dataPath || dc.id;
          skipKeys.add(path.split('.')[0]); // Исключаем корневой ключ
        }
      }
    }
  }
  const filteredNewVal: any = {};
  for (const k in newVal) {
    if (!skipKeys.has(k)) filteredNewVal[k] = (newVal as any)[k];
  }
  merge(formData.value, filteredNewVal);
  lastEmittedData.value = JSON.stringify({ ...formData.value, __foreignUpdates: foreignUpdates.value });
}, { deep: true });

onMounted(() => {
  loadConfigAndData();

  // Alt+1..9 — switch section
  const onSwitchSection = (e: CustomEvent) => {
    if (!config.value?.sections) return;
    const idx = e.detail as number;
    const section = config.value.sections[idx];
    if (section) {
      activeSection.value = section.id;
      emit('section-change', section.id);
    }
  };
  document.addEventListener('ww:switch-section', onSwitchSection as EventListener);
  const onEntitySaved = () => {
    loadReferenceData();
    if (showHistory.value) {
      setTimeout(() => {
        loadHistory();
      }, 500);
    }
  };
  document.addEventListener('ww:entity-saved', onEntitySaved);
  
  const handleToggleHistory = (e: any) => {
    console.log(`[EntityEditor.vue] handleToggleHistory triggered, detail.id=`, e.detail?.id, ` props.entityId=`, props.entityId);
    if (e.detail && e.detail.id === props.entityId) {
      console.log(`[EntityEditor.vue] MATCH! calling toggleHistory()`);
      toggleHistory();
    }
  };
  document.addEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);

  onUnmounted(() => {
    document.removeEventListener('ww:switch-section', onSwitchSection as EventListener);
    document.removeEventListener('ww:entity-saved', onEntitySaved);
    document.removeEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);
  });

  settingsService.onChange((newSettings: any) => {
    wheelHorizontal.value = newSettings?.dropdowns?.wheelOrientation === 'horizontal';
  });
});

  return {
    loading,
    isInitializing,
    config,
    formData,
    lastEmittedData,
    foreignUpdates,
    activeSection,
    referenceData,
    hoverState,
    scrollContainer,
    showHistory,
    isLoadingHistory,
    revisions,
    isPreviewingHistory,
    previewingRevId,
    currentSavedData,
    maxSaves,
    togglePin,
    loadHistory,
    toggleHistory,
    previewHistory,
    exitHistoryPreview,
    restoreHistory,
    getDiffSummary,
    isFieldChanged,
    photoUrlCache,
    getPhotoUrl,
    getProp,
    setProp,
    getResolvedTemplate,
    loadConfigAndData,
    loadReferenceData,
    getOptionsFor,
    markModified,
    handleForeignUpdate,
    addDynamicItem,
    removeDynamicItem,
    triggerPhotoUpload,
    handlePhotoFile,
    handlePhotoDrop,
    removePhoto
  };
}
