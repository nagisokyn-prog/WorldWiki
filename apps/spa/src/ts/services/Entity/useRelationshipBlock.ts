import { ref, computed, watch } from 'vue';
import { apiService } from '../api.service'; // Adjust path if needed
import { settingsService } from '@worldwiki/components';

export function useRelationshipBlock(props: any, emit: any) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

  const foreignItem = ref<any>(null);
  const foreignLoading = ref(false);
  const foreignError = ref('');
  const foreignModified = ref(false);

  const getResolvedFields = (subConf?: any) => {
    subConf = subConf || props.templateConf;
    let tpl: any = null;
    if (subConf.fields && !subConf.template) {
      tpl = subConf;
    } else {
      tpl = props.allTemplates[subConf.template];
    }
    if (!tpl || !tpl.fields) return [];
    if (!subConf.fieldOverrides) return tpl.fields;
    
    return tpl.fields.map((f: any) => {
      const override = subConf.fieldOverrides[f.class];
      if (override) {
        if (override.hidden) return null;
        return { ...f, ...override };
      }
      return f;
    }).filter((f: any) => f !== null);
  };

  // Имя поля-ссылки (персонаж / родственник)
  const linkClass = computed(() => props.templateConf.bidirectionalLinkClass || '');

  // Подпись "моей" стороны
  const myLabel = computed(() => {
    const myList = props.referenceData[props.entityType] || [];
    return myList.find((o: any) => String(o.value) === String(props.entityId))?.label || 'Эта запись';
  });

  // Подпись чужой
  const foreignLabel = computed(() => {
    if (!props.item[linkClass.value]) return 'Взаимное отношение';
    const entityType = props.templateConf.fields.find((f: any) => f.class === linkClass.value)?.entityType;
    const list = entityType ? (props.referenceData[entityType] || []) : [];
    return list.find((o: any) => String(o.value) === String(props.item[linkClass.value]))?.label || 'Выбранная запись';
  });

  // Helper для синхронизации item с родителем
  const notifyItemUpdate = (e?: Event): void => {
    emit('modified');
  };

  // Helper для синхронизации вложенного контейнера
  const notifyNestedItemUpdate = (containerKeyOrEvent?: string | Event): void => {
    const containerKey = typeof containerKeyOrEvent === 'string' ? containerKeyOrEvent : (props.templateConf.dataPath || props.templateConf.id || 'foreign_ids');
    if (typeof containerKey === 'string' && props.item[containerKey] && Array.isArray(props.item[containerKey])) {
      const containerBefore = props.item[containerKey] as any[];
      props.item[containerKey] = [...containerBefore];
    }
    emit('modified');
  };

  // Обработчик для select полей
  const onSelectChange = (fieldClass: string, val: any): void => {
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
    if (!props.item.link_data) props.item.link_data = {};
    props.item.link_data[fieldClass] = (e.target as any).value;
    emit('modified');
    await fetchForeignItem();
  };

  const loadForeignItem = async (targetId: any): Promise<void> => {
    const tpl = props.templateConf;
    const linkField = tpl.fields.find((f: any) => f.class === linkClass.value);
    const targetEntityType = linkField?.entityType;
    if (!targetEntityType) return;

    foreignLoading.value = true;
    foreignError.value = '';
    foreignModified.value = false;

    try {
      const targetData = await apiService.getEntity(props.project, targetEntityType, String(targetId));
      if (!targetData) {
        throw new Error(`Entity ${targetId} not found or returned null`);
      }

      let relArray: any[] = [];
      const tData = (targetData as any).data || targetData;

      if (tpl.dynamicContainers) {
        for (const sub of tpl.dynamicContainers) {
          const key = sub.dataPath || sub.id;
          const arr = getDeepProp(tData, key);
          if (Array.isArray(arr)) { relArray = arr; break; }
        }
      }
      
      if (relArray.length === 0 && tData.characterRelationships) {
        relArray = tData.characterRelationships;
      }

      let matched: any = relArray.find((r: any) => String(r[linkClass.value]) === String(props.entityId));
      
      if (!matched) {
        const rawEntityId = String(props.entityId).split(':').pop() || String(props.entityId);
        matched = relArray.find((r: any) => {
          const rawTargetId = String(r[linkClass.value]).split(':').pop() || String(r[linkClass.value]);
          return rawTargetId === rawEntityId;
        });
      }
      
      if (!matched) {
        matched = { [linkClass.value]: props.entityId };
        
        if (props.templateConf.dynamicContainers) {
          props.templateConf.dynamicContainers.forEach((sub: any) => {
            const key = sub.dataPath || sub.id;
            matched[key] = [];
          });
        }
        
        if (matched['динамика_отношений'] !== undefined && matched['relationshipStates'] !== undefined) {
          delete matched['relationshipStates'];
        }
      }

      const deepCopied = JSON.parse(JSON.stringify(matched));
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

  watch(foreignItem, (val: any) => {
    if (val) {
      const cleanedData = { ...(val || {}) };
      if (cleanedData['динамика_отношений'] !== undefined) {
        delete cleanedData['relationshipStates'];
      }
      if (cleanedData['семейные_отношения'] !== undefined) {
        delete cleanedData['familyRelationshipStates'];
      }
      
      const entityTypeVal = props.templateConf.fields.find((f: any) => f.class === linkClass.value)?.entityType;
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

  const getOptions = (field?: any): any[] => {
    if (field?.options?.length) return field.options;
    const type = field?.entityType || props.templateConf.foreign_type;
    if (type && props.referenceData[type]) return props.referenceData[type];
    return [];
  };

  const getNestedList = (sourceItem?: any, subConf?: any): any[] => {
    sourceItem = sourceItem || props.item;
    subConf = subConf || props.templateConf;
    const key = subConf.dataPath || subConf.id || 'foreign_ids';
    const val = getDeepProp(sourceItem, key);
    return Array.isArray(val) ? val : [];
  };

  const addNestedItem = (sourceItemOrEvent?: any, subConf?: any): void => {
    const sourceItem = (sourceItemOrEvent instanceof Event) ? props.item : (sourceItemOrEvent || props.item);
    subConf = subConf || props.templateConf;
    const key = subConf.dataPath || subConf.id || 'foreign_ids';
    
    if (!sourceItem[key]) {
      sourceItem[key] = [];
    }
    
    let tpl: any = null;
    if (subConf.fields && !subConf.template) {
      tpl = subConf;
    } else {
      tpl = props.allTemplates[subConf.template];
    }
    const newEntry: any = {};
    tpl?.fields?.forEach((f: any) => { newEntry[f.class] = f.value ?? ''; });
    
    sourceItem[key].push(newEntry);
    notifyItemUpdate();
  };

  const removeNestedItem = (nIdx: number, sourceItem?: any, subConf?: any): void => {
    sourceItem = sourceItem || props.item;
    subConf = subConf || props.templateConf;
    const key = subConf.dataPath || subConf.id || 'foreign_ids';
    if (Array.isArray(sourceItem[key])) {
      sourceItem[key].splice(nIdx, 1);
      notifyItemUpdate();
    }
  };

  const getDeepProp = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((cur: any, k: string) => (cur && cur[k] !== undefined ? cur[k] : undefined), obj);
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
    addNestedItem,
    removeNestedItem,
    getDeepProp
  };
}
