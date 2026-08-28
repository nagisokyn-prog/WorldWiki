import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import * as api from '../../../services/api.client';
import type { EntitySchema } from '../../../types/generated/EntitySchema';
import { settingsService } from '@worldwiki/components';
import { useEntityHistory } from './hooks/useEntityHistory';
import { useEntityHelpers } from './hooks/useEntityHelpers';
import type { EntityEditorProps, SchemaConfig, SchemaSection, SchemaField, DynamicContainer } from './EntityEditor.model';

export function useEntityEditor(props: EntityEditorProps, emit: (event: string, ...args: unknown[]) => void) {
  const loading = ref(true);
  const isInitializing = ref(false); 
  const config = shallowRef<SchemaConfig | null>(null);
  const formData = ref<Record<string, unknown>>(props.initialData ? JSON.parse(JSON.stringify(props.initialData)) : {});
  const lastEmittedData = ref<string | null>(null);
  const foreignUpdates = ref<Record<string, unknown>>({});
  const activeSection = ref('');
  const referenceData = ref<Record<string, Array<{ value: string; label: string }>>>({});
  const photoInputs = ref<Record<string, HTMLInputElement>>({});
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
    const entityTypesToLoad = new Set<string>();
    
    // Always load current entity type list so myLabel and self-references work
    if (props.entityType) {
      entityTypesToLoad.add(props.entityType);
    }

    if (config.value?.sections) {
      config.value.sections.forEach((sec: SchemaSection) => {
        if (sec.fields) {
          sec.fields.forEach((f: SchemaField) => {
            if (f.entityType) {
              entityTypesToLoad.add(f.entityType);
            }
          });
        }
        if (sec.dynamicContainers) {
          sec.dynamicContainers.forEach((dc: DynamicContainer) => {
            if (dc.foreign_type) entityTypesToLoad.add(dc.foreign_type);
            const tplConf = dc.template && config.value?.templates ? config.value.templates[dc.template] : undefined;
            if (tplConf?.foreign_type) {
              entityTypesToLoad.add(tplConf.foreign_type);
            }
            if (dc.fields) {
              dc.fields.forEach((f: SchemaField) => {
                if (f.entityType) entityTypesToLoad.add(f.entityType);
              });
            }
          });
        }
      });
    }

    if (config.value?.templates) {
      Object.keys(config.value.templates).forEach(tplKey => {
        const tpl = config.value?.templates?.[tplKey];
        if (tpl?.foreign_type) {
          entityTypesToLoad.add(tpl.foreign_type);
        }
        if (tpl?.fields) {
          tpl.fields.forEach((f: SchemaField) => {
            if (f.entityType) {
              entityTypesToLoad.add(f.entityType);
            }
          });
        }
        if (tpl?.dynamicContainers) {
          tpl.dynamicContainers.forEach((dc: DynamicContainer) => {
            if (dc.foreign_type) entityTypesToLoad.add(dc.foreign_type);
            if (dc.fields) {
              dc.fields.forEach((f: SchemaField) => {
                if (f.entityType) {
                  entityTypesToLoad.add(f.entityType);
                }
              });
            }
          });
        }
      });
    }

    const newRefData: Record<string, Array<{ value: string; label: string }>> = { ...referenceData.value };
    for (const type of entityTypesToLoad) {
      try {
        const entities = await api.getEntities(props.project, type);
        const mapped = entities.map((e) => {
          const item = e as Record<string, unknown>;
          return {
            value: String(item.id || ''),
            label: String(item.name || item.title || item.label || 'Без названия')
          };
        });
        newRefData[`${type}_list`] = mapped;
        newRefData[type] = mapped;
      } catch (e) {
        console.error(`Error loading ref data for ${type}:`, e);
      }
    }
    referenceData.value = newRefData;
  };

  const loadConfigAndData = async () => {
    loading.value = true;
    isInitializing.value = true;
    try {
      const patchConfig = (cfg: SchemaConfig) => {
        if (cfg?.sections) {
          cfg.sections.forEach((sec: SchemaSection & { items?: Array<Record<string, unknown>> }) => {
            if (sec.items && (!sec.fields || sec.fields.length === 0) && (!sec.dynamicContainers || sec.dynamicContainers.length === 0)) {
              const fields: Array<SchemaField> = [];
              const dynamicContainers: Array<DynamicContainer> = [];
              sec.items.forEach((it: Record<string, unknown>) => {
                if (it.template || it.dataPath || it.type === 'dynamic' || it.type === 'timeline') {
                  dynamicContainers.push(it as unknown as DynamicContainer);
                } else {
                  fields.push(it as unknown as SchemaField);
                }
              });
              sec.fields = fields;
              sec.dynamicContainers = dynamicContainers;
            }
            if (sec.dynamicContainers) {
              sec.dynamicContainers.forEach((dc: DynamicContainer, idx: number) => {
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
        const foundSchema = schemas.find((s: EntitySchema) => s.type_key === props.entityType);
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
         if (props.initialSection && config.value.sections.some((s: SchemaSection) => s.id === props.initialSection)) {
           activeSection.value = props.initialSection;
         } else {
           activeSection.value = config.value.sections[0].id;
         }
         emit('section-change', activeSection.value);
       }
       
       formData.value = JSON.parse(JSON.stringify(props.initialData || {}));
       foreignUpdates.value = {}; 
       
       lastEmittedData.value = JSON.stringify({ ...formData.value, __foreignUpdates: {} });
       
       await loadReferenceData();
       
    } catch (e) {
      console.error('[EntityEditor] Error loading:', e);
    } finally {
      await nextTick();
      loading.value = false;
      isInitializing.value = false;

      if ((props.initialScrollPos ?? 0) > 0) {
        setTimeout(() => {
          if (scrollContainer.value) scrollContainer.value.scrollTop = props.initialScrollPos ?? 0;
        }, 100);
      }
      
      nextTick(() => {
        if (scrollContainer.value) {
          scrollContainer.value.addEventListener('scroll', (e: Event) => {
            emit('scroll-change', (e.target as HTMLElement).scrollTop);
          });
        }
      });
    }
  };

  const onSchemaUpdated = (e: Event) => {
    const customEvent = e as CustomEvent<{ entityType?: string }>;
    if (!customEvent.detail || customEvent.detail.entityType === props.entityType) {
      loadConfigAndData();
    }
  };

  onMounted(() => {
    window.addEventListener('ww:schema-updated', onSchemaUpdated);
  });

  onUnmounted(() => {
    window.removeEventListener('ww:schema-updated', onSchemaUpdated);
  });

  watch(() => config.value, (newConfig) => {
    if (newConfig && newConfig.sections && newConfig.sections.length > 0 && !activeSection.value) {
      if (props.initialSection && newConfig.sections.some((s: SchemaSection) => s.id === props.initialSection)) {
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
        formData.value = JSON.parse(JSON.stringify(newVal || {}));
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

  const handleToggleHistory = (e: CustomEvent) => {
    if (e.detail.id === props.entityId || e.detail.id === `${props.entityType}:${props.entityId}`) {
      historyHook.toggleHistory();
    }
  };

  onMounted(() => {
    loadConfigAndData();
    window.addEventListener('ww:global-save-triggered', historyHook.loadHistory);
    document.addEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);
  });
  
  onUnmounted(() => {
    window.removeEventListener('ww:global-save-triggered', historyHook.loadHistory);
    document.removeEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);
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

  const handlePhotoFile = async (event: Event, fieldClass: string) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      try {
        const path = await uploadPhoto(file);
        helpers.setProp(fieldClass, path);
      } catch {
        const { appAlert } = await import('@worldwiki/components');
        appAlert('Ошибка загрузки фото');
      }
    }
  };

  const handlePhotoDrop = async (event: DragEvent, fieldClass: string) => {
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const path = await uploadPhoto(file);
        helpers.setProp(fieldClass, path);
      } catch {
        const { appAlert } = await import('@worldwiki/components');
        appAlert('Ошибка загрузки фото');
      }
    }
  };

  const removePhoto = (fieldClass: string) => {
    helpers.setProp(fieldClass, '');
  };

  const handleForeignUpdate = (e: { foreignPath?: string; value?: unknown; entityType?: string; entityId?: string; [key: string]: unknown }) => {
    if (e.foreignPath) {
      const parts = e.foreignPath.split('.');
      let current: Record<string, unknown> = foreignUpdates.value;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]] as Record<string, unknown>;
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

  const onDynamicUpdate = (e: { localPath?: string; foreignPath?: string; value?: unknown; entityType?: string; entityId?: string; [key: string]: unknown }) => {
    if (e.localPath) {
      helpers.setProp(e.localPath, e.value);
    } else if (e.foreignPath) {
      handleForeignUpdate(e);
    }
  };

  const addDynamicItem = (path: string, templateNameOrObj: string | { fields?: SchemaField[]; [key: string]: unknown }) => {
    if (!path) {
        console.warn('addDynamicItem: path is undefined, container lacks dataPath and id in schema');
        return;
    }
    const arr = (helpers.getProp(formData.value, path) as unknown[]) || [];
    const tpl = typeof templateNameOrObj === 'string' ? config.value?.templates?.[templateNameOrObj] : templateNameOrObj;
    if (!tpl) return;
    const newItem: Record<string, unknown> = {};
    if (tpl.fields) {
      tpl.fields.forEach((f: SchemaField & { default?: unknown }) => {
        if (f.class) {
          newItem[f.class] = f.default !== undefined ? f.default : '';
        }
      });
    }
    helpers.setProp(formData.value, path, [...arr, newItem]);
    markModified();
  };

  const removeDynamicItem = (path: string, idx: number) => {
    const arr = (helpers.getProp(formData.value, path) as unknown[]) || [];
    arr.splice(idx, 1);
    helpers.setProp(formData.value, path, arr);
    markModified();
  };

  const getOptionsFor = (field: SchemaField) => {
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