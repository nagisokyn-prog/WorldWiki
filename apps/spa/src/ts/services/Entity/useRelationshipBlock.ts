import { ref, computed, watch } from 'vue';
import { entityApi } from './entity.api';
import { settingsService } from '@worldwiki/components';

export interface TemplateConf {
  template?: string;
  bidirectionalLinkClass?: string;
  fields?: Array<{ class?: string; entityType?: string; options?: Array<{ value: string; label: string }>; value?: unknown; [key: string]: unknown }>;
  dynamicContainers?: Array<{ id: string; template?: string; dataPath?: string; [key: string]: unknown }>;
  foreign_type?: string;
  fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }>;
  dataPath?: string;
  id?: string;
  [key: string]: unknown;
}

export interface RelationshipBlockProps {
  templateConf: TemplateConf;
  allTemplates: Record<string, { fields?: Array<{ class?: string; value?: unknown; [key: string]: unknown }>; [key: string]: unknown }>;
  referenceData: Record<string, Array<{ value: unknown; label: string; [key: string]: unknown }>>;
  item: Record<string, unknown>;
  entityType: string;
  entityId: string;
  project: string;
  sandboxMode?: boolean;
}

export interface SubConf {
  template?: string;
  fields?: Array<{ class?: string; value?: unknown; [key: string]: unknown }>;
  fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }>;
  dataPath?: string;
  id?: string;
  [key: string]: unknown;
}

export function useRelationshipBlock(props: RelationshipBlockProps, emit: (event: string, ...args: unknown[]) => void) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

  const foreignItem = ref<Record<string, unknown> | null>(null);
  const foreignLoading = ref(false);
  const foreignError = ref('');
  const foreignModified = ref(false);

  const getResolvedFields = (subConf?: SubConf) => {
    const config = subConf || props.templateConf;
    let tpl: { fields?: Array<{ class?: string; [key: string]: unknown }> } | undefined;
    const templateKey = typeof config.template === 'string' ? config.template : '';
    if (config.fields && !config.template) {
      tpl = config;
    } else if (templateKey && props.allTemplates[templateKey]) {
      tpl = props.allTemplates[templateKey];
    }
    if (!tpl || !tpl.fields) return [];
    const overrides = config.fieldOverrides as Record<string, { hidden?: boolean; [key: string]: unknown }> | undefined;
    if (!overrides) return tpl.fields;
    
    return tpl.fields.map((f) => {
      const override = f.class && overrides ? overrides[f.class] : undefined;
      if (override) {
        if (override.hidden) return null;
        return { ...f, ...override };
      }
      return f;
    }).filter((f): f is NonNullable<typeof f> => f !== null);
  };

  // Имя поля-ссылки (персонаж / родственник)
  const linkClass = computed(() => props.templateConf.bidirectionalLinkClass || '');

  // Подпись "моей" стороны
  const myLabel = computed(() => {
    const myList = props.referenceData[props.entityType] || [];
    return myList.find((o) => String(o.value) === String(props.entityId))?.label || 'Эта запись';
  });

  // Подпись чужой
  const foreignLabel = computed(() => {
    if (!props.item[linkClass.value]) return 'Взаимное отношение';
    const entityType = props.templateConf.fields?.find((f) => f.class === linkClass.value)?.entityType;
    const list = entityType ? (props.referenceData[entityType] || []) : [];
    return list.find((o) => String(o.value) === String(props.item[linkClass.value]))?.label || 'Выбранная запись';
  });

  // Helper для синхронизации item с родителем
  const notifyItemUpdate = (_e?: Event): void => {
    emit('modified');
  };

  // Helper для синхронизации вложенного контейнера
  const notifyNestedItemUpdate = (containerKeyOrEvent?: string | Event): void => {
    const containerKey = typeof containerKeyOrEvent === 'string' ? containerKeyOrEvent : (props.templateConf.dataPath || props.templateConf.id || 'foreign_ids');
    if (typeof containerKey === 'string' && props.item[containerKey] && Array.isArray(props.item[containerKey])) {
      const containerBefore = props.item[containerKey] as unknown[];
      props.item[containerKey] = [...containerBefore];
    }
    emit('modified');
  };

  // Обработчик для select полей
  const onSelectChange = (fieldClass: string, val: unknown): void => {
    props.item[fieldClass] = val;
    notifyItemUpdate();
  };

  const makeSelectHandler = (nIdx: number) => {
    return (e: Event) => {
      const val = (e.target as HTMLSelectElement).value;
      const arr = getNestedList();
      if (arr[nIdx]) {
        arr[nIdx].foreign_id = val;
        notifyItemUpdate();
      }
    };
  };

  const fetchForeignItem = async () => {
    const targetId = props.item[linkClass.value];
    
    if (!targetId) {
      foreignItem.value = null;
      return;
    }

    if (props.sandboxMode) {
      foreignItem.value = {
        [linkClass.value]: props.entityId,
        динамика_отношений: []
      };
      return;
    }

    await loadForeignItem(targetId);
  };

  const onLinkChange = (fieldClass: string) => async (e: Event): Promise<void> => {
    if (!props.item.link_data || typeof props.item.link_data !== 'object') {
      props.item.link_data = {};
    }
    (props.item.link_data as Record<string, unknown>)[fieldClass] = (e.target as HTMLInputElement | HTMLSelectElement).value;
    emit('modified');
    await fetchForeignItem();
  };

  const loadForeignItem = async (targetId: unknown): Promise<void> => {
    const tpl = props.templateConf;
    const linkField = tpl.fields?.find((f) => f.class === linkClass.value);
    const targetEntityType = linkField?.entityType;
    if (!targetEntityType) return;

    foreignLoading.value = true;
    foreignError.value = '';
    foreignModified.value = false;

    try {
      const targetData = await entityApi.getEntity(props.project, targetEntityType, String(targetId));
      if (!targetData) {
        throw new Error(`Entity ${targetId} not found or returned null`);
      }

      let relArray: Array<Record<string, unknown>> = [];
      const tData = (targetData as { data?: Record<string, unknown> }).data || targetData;

      if (tpl.dynamicContainers) {
        for (const sub of tpl.dynamicContainers) {
          const key = sub.dataPath || sub.id;
          const arr = getDeepProp(tData, key);
          if (Array.isArray(arr)) { relArray = arr as Array<Record<string, unknown>>; break; }
        }
      }
      
      if (relArray.length === 0 && Array.isArray(tData.characterRelationships)) {
        relArray = tData.characterRelationships as Array<Record<string, unknown>>;
      }

      let matched: Record<string, unknown> | undefined = relArray.find((r) => String(r[linkClass.value]) === String(props.entityId));
      
      if (!matched) {
        const rawEntityId = String(props.entityId).split(':').pop() || String(props.entityId);
        matched = relArray.find((r) => {
          const rawTargetId = String(r[linkClass.value]).split(':').pop() || String(r[linkClass.value]);
          return rawTargetId === rawEntityId;
        });
      }
      
      if (!matched) {
        matched = { [linkClass.value]: props.entityId };
        
        if (props.templateConf.dynamicContainers) {
          props.templateConf.dynamicContainers.forEach((sub) => {
            const key = sub.dataPath || sub.id;
            (matched as Record<string, unknown>)[key] = [];
          });
        }
        
        if (matched['динамика_отношений'] !== undefined && matched['relationshipStates'] !== undefined) {
          delete matched['relationshipStates'];
        }
      }

      const deepCopied = JSON.parse(JSON.stringify(matched)) as Record<string, unknown>;
      foreignItem.value = deepCopied;
    } catch(e) {
      foreignError.value = 'Ошибка загрузки: ' + String(e);
    } finally {
      foreignLoading.value = false;
    }
  };

  watch(() => props.item[linkClass.value], (newVal) => {
    if (newVal && !foreignItem.value) {
      loadForeignItem(String(newVal));
    }
  }, { immediate: true });

  watch(foreignItem, (val) => {
    if (val) {
      const cleanedData = { ...(val || {}) };
      if (cleanedData['динамика_отношений'] !== undefined) {
        delete cleanedData['relationshipStates'];
      }
      if (cleanedData['семейные_отношения'] !== undefined) {
        delete cleanedData['familyRelationshipStates'];
      }
      
      const entityTypeVal = props.templateConf.fields?.find((f) => f.class === linkClass.value)?.entityType;
      const targetEntityId = String(props.item[linkClass.value]);
      
      emit('foreign-update', {
        entityType: entityTypeVal,
        entityId: targetEntityId,
        data: cleanedData,
        linkClass: linkClass.value,
        backLinkValue: props.entityId
      });
    }
  }, { deep: true, flush: 'sync' });

  const getOptions = (field?: { options?: Array<{ value: string; label: string }>; entityType?: string }): Array<{ value: unknown; label: string }> => {
    if (field?.options?.length) return field.options;
    const type = field?.entityType || (props.templateConf.foreign_type as string | undefined);
    if (type) {
      if (props.referenceData[`${type}_list`]) return props.referenceData[`${type}_list`];
      if (props.referenceData[type]) return props.referenceData[type];
    }
    return [];
  };

  const getNestedList = (sourceItem?: Record<string, unknown>, subConf?: SubConf): Array<Record<string, unknown>> => {
    const item = sourceItem || props.item;
    const config = subConf || props.templateConf;
    const key = config.dataPath || config.id || 'foreign_ids';
    const val = getDeepProp(item, key);
    return Array.isArray(val) ? (val as Array<Record<string, unknown>>) : [];
  };

  const getDynamicContainerFields = (subConf: SubConf): Array<{ class?: string; value?: unknown; [key: string]: unknown }> => {
    if (subConf.fields && subConf.fields.length > 0) return subConf.fields;
    if (subConf.template && props.allTemplates[subConf.template]) {
      return props.allTemplates[subConf.template].fields || [];
    }
    return [];
  };

  const addNestedItem = (sourceItemOrEvent?: Record<string, unknown> | Event, subConf?: SubConf): void => {
    const sourceItem: Record<string, unknown> = (sourceItemOrEvent instanceof Event) ? props.item : ((sourceItemOrEvent as Record<string, unknown>) || props.item);
    const config = subConf || props.templateConf;
    const key = config.dataPath || config.id || 'foreign_ids';
    
    if (!sourceItem[key]) {
      sourceItem[key] = [];
    }
    
    let tpl: { fields?: Array<{ class?: string; value?: unknown }> } | undefined;
    const templateKey = typeof config.template === 'string' ? config.template : '';
    if (config.fields && !config.template) {
      tpl = config;
    } else if (templateKey && props.allTemplates[templateKey]) {
      tpl = props.allTemplates[templateKey];
    }
    const newEntry: Record<string, unknown> = {};
    tpl?.fields?.forEach((f) => { if (f.class) newEntry[f.class] = f.value ?? ''; });
    
    (sourceItem[key] as Array<Record<string, unknown>>).push(newEntry);
    notifyItemUpdate();
  };

  const removeNestedItem = (nIdx: number, sourceItem?: Record<string, unknown>, subConf?: SubConf): void => {
    const item = sourceItem || props.item;
    const config = subConf || props.templateConf;
    const key = config.dataPath || config.id || 'foreign_ids';
    const list = item[key];
    if (Array.isArray(list)) {
      list.splice(nIdx, 1);
      notifyItemUpdate();
    }
  };

  const getDeepProp = (obj: Record<string, unknown> | null | undefined, path: string): unknown => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((cur: unknown, k: string) => (cur != null && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined), obj as unknown);
  };

  const updateItemField = (fieldClass: string, val: unknown) => {
    props.item[fieldClass] = val;
    notifyItemUpdate();
  };

  return {
    wheelHorizontal,
    foreignItem,
    foreignLoading,
    foreignError,
    foreignModified,
    linkClass,
    myLabel,
    foreignLabel,
    getResolvedFields,
    notifyItemUpdate,
    notifyNestedItemUpdate,
    onSelectChange,
    makeSelectHandler,
    onLinkChange,
    getOptions,
    getNestedList,
    getDynamicContainerFields,
    addNestedItem,
    removeNestedItem,
    getDeepProp,
    updateItemField
  };
}
