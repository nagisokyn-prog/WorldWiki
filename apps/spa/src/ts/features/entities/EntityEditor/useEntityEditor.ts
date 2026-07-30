import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import * as api from '../../../services/api.client';;
import { settingsService } from '@worldwiki/components';
import { useEntityHistory } from './hooks/useEntityHistory';
import { useEntityHelpers } from './hooks/useEntityHelpers';

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

  const historyHook = useEntityHistory(props, emit, formData);
  const helpers = useEntityHelpers(formData, config);

  const markModified = () => {
    if (isInitializing.value || historyHook.isPreviewingHistory.value) return;
    
    const combinedData = { ...formData.value, __foreignUpdates: foreignUpdates.value };
    const currentSerialized = JSON.stringify(combinedData);
    
    if (currentSerialized !== lastEmittedData.value) {
      emit('modified');
      emit('update:modelValue', combinedData);
      emit('update-data', combinedData);
      lastEmittedData.value = currentSerialized;
    }
  };

  const loadReferenceData = async () => {
    if (!config.value || !config.value.sections) return;
    
    const fieldsToLoad: { field: any, sectionId: string }[] = [];
    config.value.sections.forEach((sec: any) => {
      if (sec.fields) {
        sec.fields.forEach((f: any) => {
          if ((f.type === 'select' || f.type === 'multiselect') && f.entityType) {
            fieldsToLoad.push({ field: f, sectionId: sec.id });
          }
        });
      }
    });

    if (config.value.templates) {
      Object.keys(config.value.templates).forEach(tplKey => {
        const tpl = config.value.templates[tplKey];
        if (tpl.fields) {
          tpl.fields.forEach((f: any) => {
            if ((f.type === 'select' || f.type === 'multiselect') && f.entityType) {
              fieldsToLoad.push({ field: f, sectionId: 'template_' + tplKey });
            }
          });
        }
        if (tpl.dynamicContainers) {
          tpl.dynamicContainers.forEach((dc: any) => {
            if (dc.fields) {
              dc.fields.forEach((f: any) => {
                if ((f.type === 'select' || f.type === 'multiselect') && f.entityType) {
                  fieldsToLoad.push({ field: f, sectionId: 'template_dc_' + dc.id });
                }
              });
            }
          });
        }
      });
    }

    for (const item of fieldsToLoad) {
      try {
        const entities = await api.getEntities(props.project, item.field.entityType);
        referenceData.value[`${item.field.entityType}_list`] = entities.map((e: any) => ({
          value: e.id,
          label: e.name || 'Без названия'
        }));
      } catch (e) {
        console.error(`Error loading ref data for ${item.field.entityType}:`, e);
      }
    }
  };

  const loadConfigAndData = async () => {
    loading.value = true;
    isInitializing.value = true;
    try {
      const patchConfig = (cfg: any) => {
        if (cfg?.sections) {
          cfg.sections.forEach((sec: any) => {
            if (sec.dynamicContainers) {
              sec.dynamicContainers.forEach((dc: any, idx: number) => {
                if (!dc.id) dc.id = dc.template ? `dyn_${dc.template}` : `dyn_${idx}`;
                if (!dc.dataPath) dc.dataPath = dc.id;
              });
            }
          });
        }
        return cfg;
      };

      const sandboxConfig = sessionStorage.getItem('sandbox_preview_config');
      if (props.entityId === 'preview' && sandboxConfig) {
        config.value = patchConfig(JSON.parse(sandboxConfig));
      } else {
        const schemas = await api.getEntitySchemas(props.project);
        const foundSchema = schemas.find((s: any) => s.type_key === props.entityType);
        if (foundSchema && foundSchema.full_schema) {
          config.value = patchConfig(JSON.parse(JSON.stringify(foundSchema.full_schema)));
        } else {
          try {
            // Only fetch for known static schemas to prevent 404s for custom types
            const staticTypes = ['character', 'location', 'event', 'fraction', 'item', 'ui_editor'];
            if (staticTypes.includes(props.entityType)) {
              const res = await fetch(`/struct/editor/${props.entityType}.json`);
              if (res.ok) {
                config.value = patchConfig(await res.json());
              }
            }
          } catch (e) {
            console.warn('Failed to load static schema', e);
          }
        }
      }
      
      if (!config.value) {
        config.value = { templates: {}, sections: [] };
      }

      try {
        const uiRes = await fetch('/struct/editor/ui_editor.json');
        if (uiRes.ok) {
          const uiData = await uiRes.json();
          if (!config.value.templates) {
            config.value.templates = {};
          }
          if (uiData && uiData.templates) {
            Object.assign(config.value.templates, uiData.templates);
          }
        }
      } catch (e) {
        console.warn('[EntityEditor] Failed to load ui_editor.json templates', e);
      }

       if (config.value && config.value.sections && config.value.sections.length > 0) {
         if (props.initialSection && config.value.sections.some((s: any) => s.id === props.initialSection)) {
           activeSection.value = props.initialSection;
         } else {
           activeSection.value = config.value.sections[0].id;
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
  }, { immediate: true });

  watch(() => props.initialData, (newVal) => {
    if (!historyHook.isPreviewingHistory.value) {
      const isDiff = JSON.stringify(newVal) !== JSON.stringify(formData.value);
      if (isDiff) {
        isInitializing.value = true;
        formData.value = JSON.parse(JSON.stringify(newVal));
        lastEmittedData.value = JSON.stringify({ ...formData.value, __foreignUpdates: foreignUpdates.value });
        nextTick(() => {
          isInitializing.value = false;
        });
      }
    }
  }, { deep: true });

  watch(formData, () => {
    markModified();
  }, { deep: true });

  watch(foreignUpdates, () => {
    markModified();
  }, { deep: true });

  watch(activeSection, (newSec) => {
    if (newSec) emit('section-change', newSec);
  });

  onMounted(() => {
    loadConfigAndData();
    window.addEventListener('ww:global-save-triggered', historyHook.loadHistory);
  });
  
  onUnmounted(() => {
    window.removeEventListener('ww:global-save-triggered', historyHook.loadHistory);
  });

  const uploadPhoto = async (file: File) => {
    try {
      const path = await api.uploadPhoto(Array.from(new Uint8Array(await file.arrayBuffer())), file.name);
      return path;
    } catch (e) {
      console.error('Photo upload failed:', e);
      throw e;
    }
  };

  const triggerPhotoUpload = (fieldClass: string) => {
    if (photoInputs.value[fieldClass]) {
      photoInputs.value[fieldClass].click();
    }
  };

  const handlePhotoFile = async (event: any, fieldClass: string) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const path = await uploadPhoto(file);
        helpers.setProp(fieldClass, path);
      } catch (e) {
        alert('Ошибка загрузки фото');
      }
    }
  };

  const handlePhotoDrop = async (event: any, fieldClass: string) => {
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const path = await uploadPhoto(file);
        helpers.setProp(fieldClass, path);
      } catch (e) {
        alert('Ошибка загрузки фото');
      }
    }
  };

  const removePhoto = (fieldClass: string) => {
    helpers.setProp(fieldClass, '');
  };

  const onDynamicUpdate = (e: any) => {
    if (e.localPath) {
      helpers.setProp(e.localPath, e.value);
    } else if (e.foreignPath) {
      handleForeignUpdate(e);
    }
  };

  const handleForeignUpdate = (e: any) => {
    if (e.foreignPath) {
      const parts = e.foreignPath.split('.');
      let current = foreignUpdates.value;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = e.value;
    } else if (e.entityType && e.entityId) {
      const updateKey = `${e.entityType}:${e.entityId}`;
      foreignUpdates.value = {
        ...foreignUpdates.value,
        [updateKey]: e
      };
    }
  };

  const addDynamicItem = (path: string, templateNameOrObj: any) => {
    if (!path) {
        console.warn('addDynamicItem: path is undefined, container lacks dataPath and id in schema');
        return;
    }
    const arr = helpers.getProp(formData.value, path) || [];
    const tpl = typeof templateNameOrObj === 'string' ? config.value?.templates?.[templateNameOrObj] : templateNameOrObj;
    if (!tpl) return;
    const newItem: any = {};
    if (tpl.fields) {
      tpl.fields.forEach((f: any) => {
        newItem[f.class] = f.default !== undefined ? f.default : '';
      });
    }
    helpers.setProp(formData.value, path, [...arr, newItem]);
    markModified();
  };

  const removeDynamicItem = (path: string, idx: number) => {
    const arr = helpers.getProp(formData.value, path) || [];
    arr.splice(idx, 1);
    helpers.setProp(formData.value, path, arr);
    markModified();
  };

  const getOptionsFor = (field: any) => {
    if (field.entityType && referenceData.value[`${field.entityType}_list`]) {
      return referenceData.value[`${field.entityType}_list`];
    }
    return field.options || [];
  };

  return {
    loading,
    isInitializing,
    config,
    formData,
    activeSection,
    referenceData,
    photoInputs,
    hoverState,
    scrollContainer,
    wheelHorizontal,
    triggerPhotoUpload,
    handlePhotoFile,
    handlePhotoDrop,
    removePhoto,
    onDynamicUpdate,
    lastEmittedData,
    foreignUpdates,
    loadConfigAndData,
    loadReferenceData,
    getOptionsFor,
    markModified,
    handleForeignUpdate,
    addDynamicItem,
    removeDynamicItem,
    ...historyHook,
    ...helpers
  };
}