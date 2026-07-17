import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import { apiService } from '../../../services/api.service';
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
const photoInputs = ref<Record<string, any>>({});
const hoverState = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);
const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

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
    currentSavedData.value = JSON.parse(JSON.stringify(formData.value));
  }
  isPreviewingHistory.value = true;
  previewingRevId.value = rev.id;
  
  console.log('[EntityEditor] previewHistory rev:', rev);
  console.log('[EntityEditor] previewHistory rev.content:', rev.content);
  console.log('[EntityEditor] previewHistory rev.content.attributes:', rev.content?.attributes);
  console.log('[EntityEditor] previewHistory rev.content.data:', rev.content?.data);

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
  emit('modified');
  lastEmittedData.value = null; 
  markModified();
};

const getDiffSummary = (current: any, previous: any) => {
  if (!previous) return '';
  const currData = current.content?.attributes || current.content?.data || current.content || {};
  const prevData = previous.content?.attributes || previous.content?.data || previous.content || {};
  
  const changes = [];
  
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
  isInitializing.value = true;
  try {
    const sandboxConfig = sessionStorage.getItem('sandbox_preview_config');
    if (props.entityId === 'preview' && sandboxConfig) {
      console.log('[EntityEditor] 🛠️ Using Sandbox Preview Config from sessionStorage');
      config.value = JSON.parse(sandboxConfig);
    } else {
      const schemas = await apiService.getSchemas(props.project);
      if (schemas[props.entityType] && schemas[props.entityType].full_schema) {
        config.value = schemas[props.entityType].full_schema;
      } else {
        const res = await fetch(`/struct/editor/${props.entityType}.json`);
        if (res.ok) {
          config.value = await res.json();
        }
      }
    }

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

     console.log(`[EntityEditor.vue ${props.entityId}] config loaded. initialSection prop is:`, props.initialSection);
     if (config.value && config.value.sections && config.value.sections.length > 0) {
       if (props.initialSection && config.value.sections.some((s: any) => s.id === props.initialSection)) {
         activeSection.value = props.initialSection;
         console.log(`[EntityEditor.vue ${props.entityId}] Applied initialSection:`, props.initialSection);
       } else {
         activeSection.value = config.value.sections[0].id;
         console.log(`[EntityEditor.vue ${props.entityId}] initialSection not found or empty. Using default:`, activeSection.value);
       }
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

    if (props.initialScrollPos > 0) {
      setTimeout(() => {
        if (scrollContainer.value) scrollContainer.value.scrollTop = props.initialScrollPos;
      }, 100);
    }
    
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', (e: any) => {
          emit('scroll-change', e.target.scrollTop);
        });
      }
    });
  }
};

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
    } catch (e) {
      console.warn(`[EntityEditor.vue] Failed to load reference data for ${type}:`, e);
      newRefData[type] = [];
    }
  }
  
  referenceData.value = newRefData;
};

const getOptionsFor = (field: any) => {
  if (field.type === 'select' || field.type === 'multiselect') {
    if (field.options) return field.options;
    if (field.entityType && referenceData.value[field.entityType]) {
      return referenceData.value[field.entityType];
    }
  }
  return [];
};

const markModified = () => {
  console.log('[EntityEditor] markModified called → emit modified');
  emit('modified');
  const dataToEmit = JSON.parse(JSON.stringify(formData.value));
  (dataToEmit as any).__foreignUpdates = JSON.parse(JSON.stringify(foreignUpdates.value));
  emit('update-data', dataToEmit);
  lastEmittedData.value = JSON.stringify(dataToEmit);
};

const handleForeignUpdate = (payload: any) => {
  console.log('[EntityEditor.vue] 🔗 handleForeignUpdate:', payload);
  try {
    const { target, value } = payload;
    if (target) {
      setProp(formData.value, target, value);
    }
    if (!foreignUpdates.value[target]) {
      foreignUpdates.value[target] = [];
    }
    foreignUpdates.value[target].push({ value, timestamp: Date.now() });
    markModified();
  } catch (e) {
    console.error('[EntityEditor.vue] Error in handleForeignUpdate:', e);
  }
};

const addDynamicItem = (path: string, template: any) => {
  const arr = getProp(formData.value, path);
  if (!Array.isArray(arr)) {
    setProp(formData.value, path, []);
  }
  const newItem = JSON.parse(JSON.stringify(template?.template || {}));
  const currentArr = getProp(formData.value, path);
  currentArr.push(newItem);
  markModified();
};

const removeDynamicItem = (path: string, index: number) => {
  const arr = getProp(formData.value, path);
  if (Array.isArray(arr) && index >= 0 && index < arr.length) {
    arr.splice(index, 1);
    markModified();
  }
};

const triggerPhotoUpload = (path: string) => {
  if (photoInputs.value[path]) {
    photoInputs.value[path].click();
  }
};

const handlePhotoFile = async (event: any, path: string) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const reader = new FileReader();
    reader.onload = () => {
      setProp(formData.value, path, reader.result as string);
      markModified();
    };
    reader.readAsDataURL(file);
  } catch (e) {
    console.error('[EntityEditor.vue] Error handling photo file:', e);
  }
};

const handlePhotoDrop = (event: any, path: string) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    setProp(formData.value, path, reader.result as string);
    markModified();
  };
  reader.readAsDataURL(file);
};

const removePhoto = (path: string) => {
  setProp(formData.value, path, '');
  markModified();
};

onMounted(() => {
  loadConfigAndData();
});

onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', () => {});
  }
});

return {
  loading,
  isInitializing,
  wheelHorizontal,
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