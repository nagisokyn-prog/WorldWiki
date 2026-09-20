import { ref, computed, watch } from 'vue';
import { entityApi } from '@/services/Entity/entity.api';
import { settingsService } from '@worldwiki/components';
import type { TemplateField, SubConf, RelationshipBlockProps } from './RelationshipBlock.model';

export function useRelationshipBlock(props: RelationshipBlockProps, emit: (event: string, ...args: unknown[]) => void) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

  const foreignItem = ref<Record<string, unknown> | null>(null);
  const foreignLoading = ref(false);
  const foreignError = ref('');
  const foreignModified = ref(false);

  watch(
    foreignItem,
    (newVal) => {
      if (newVal) {
        const targetId = getTargetForeignId();
        const tpl = props.templateConf;
        const linkField = tpl.fields?.find((f) => f.class === linkClass.value);
        const targetEntityType = linkField?.entityType || (tpl.foreign_type as string | undefined);
        const parentDataPath = tpl.dataPath || tpl.id || tpl.template;
        const backLinkClass = tpl.bidirectionalLinkClass || linkClass.value;

        if (targetId && targetEntityType && parentDataPath) {
          emit('foreign-update', {
            entityType: targetEntityType,
            entityId: String(targetId).replace(/^[^:]+:/, ''),
            dataPath: parentDataPath,
            linkClass: backLinkClass,
            backLinkValue: props.entityId,
            item: newVal,
            data: newVal
          });
        } else {
          emit('foreign-update', newVal);
        }
      }
    },
    { deep: true }
  );

  const getResolvedFields = (subConf?: SubConf | { template?: string; fields?: TemplateField[]; fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }> }) => {
    let tpl: { fields?: TemplateField[]; fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }> } | undefined;
    if (subConf) {
      if (subConf.fields) {
        tpl = subConf;
      } else if (subConf.template) {
        const templateKey = subConf.template;
        tpl = props.allTemplates[templateKey] || undefined;
      }
    } else {
      tpl = props.templateConf;
    }
    if (!tpl) return [];

    let fields = tpl.fields || [];
    const overrides = (subConf ? subConf.fieldOverrides : props.templateConf.fieldOverrides) || {};
    
    if (overrides) {
      fields = fields.map((f) => {
        const override = f.class ? overrides[f.class] : undefined;
        if (override) {
          if (override.hidden) return null;
          return { ...f, ...override };
        }
        return f;
      }).filter((f): f is TemplateField => f !== null);
    }
    return fields;
  };

  const linkClass = computed<string>(() => {
    if (props.templateConf.bidirectionalLinkClass) {
      return props.templateConf.bidirectionalLinkClass;
    }
    const tpl = props.templateConf;
    if (tpl.fields) {
      const linkField = tpl.fields.find((f) => f.type === 'select' && f.entityType);
      if (linkField && linkField.class) return linkField.class;
      const anySelect = tpl.fields.find((f) => f.type === 'select');
      if (anySelect && anySelect.class) return anySelect.class;
      return tpl.fields[0]?.class || '';
    }
    return '';
  });

  const getTargetForeignId = () => {
    return linkClass.value ? props.item[linkClass.value] : undefined;
  };

  const getDynamicContainerFields = (subConf: SubConf) => {
    if (!subConf) return [];
    if (subConf.fields && subConf.fields.length > 0) {
      return subConf.fields;
    }
    if (subConf.template) {
      const templateKey = subConf.template;
      const tpl = props.allTemplates[templateKey];
      if (tpl && tpl.fields) {
        return tpl.fields;
      }
    }
    return [];
  };

  const myLabel = computed<string>(() => {
    const rawMyId = String(props.entityId || '').replace(/^[^:]+:/, '');
    const refList = props.referenceData[`${props.entityType}_list`] || props.referenceData[props.entityType];
    if (refList) {
      const found = refList.find((e) => {
        const item = e as Record<string, unknown>;
        const itemVal = String(item.value || item.id || '').replace(/^[^:]+:/, '');
        return itemVal === rawMyId || item.value === props.entityId || String(item.id) === props.entityId;
      });
      if (found) {
        const item = found as Record<string, unknown>;
        return String(item.label || item.name || item.value || '');
      }
    }
    return props.entityId || 'Текущая сущность';
  });

  const foreignLabel = computed<string>(() => {
    const foreignId = getTargetForeignId();
    if (!foreignId) return 'Не выбрано';
    const rawForeignId = String(foreignId).replace(/^[^:]+:/, '');
    const targetType = props.templateConf.fields?.find((f) => f.class === linkClass.value)?.entityType || (props.templateConf.foreign_type as string | undefined);
    if (!targetType) return String(foreignId);
    const refList = props.referenceData[`${targetType}_list`] || props.referenceData[targetType];
    if (refList) {
      const found = refList.find((e) => {
        const item = e as Record<string, unknown>;
        const itemVal = String(item.value || item.id || '').replace(/^[^:]+:/, '');
        return itemVal === rawForeignId || item.value === foreignId || String(item.id) === String(foreignId);
      });
      if (found) {
        const item = found as Record<string, unknown>;
        return String(item.label || item.name || item.value || '');
      }
    }
    return String(foreignId);
  });

  const loadForeignItem = async (targetId: unknown): Promise<void> => {
    if (props.sandboxMode) {
      foreignItem.value = {
        [linkClass.value]: props.entityId,
        'динамика_отношений': []
      };
      return;
    }

    const tpl = props.templateConf;
    const linkField = tpl.fields?.find((f) => f.class === linkClass.value);
    const targetEntityType = linkField?.entityType || (tpl.foreign_type as string | undefined);
    if (!targetEntityType) return;

    foreignLoading.value = true;
    foreignError.value = '';
    foreignModified.value = false;

    try {
      const targetData = await entityApi.getEntity(props.project, targetEntityType, String(targetId));
      if (!targetData) {
        throw new Error(`Entity ${targetId} not found or returned null`);
      }

      const parentDataPath = tpl.dataPath || tpl.id || tpl.template;
      let matched: Record<string, unknown> | null = null;

      const rootObj = (targetData.data && typeof targetData.data === 'object') ? targetData.data as Record<string, unknown> : targetData;
      let targetArr = (parentDataPath ? (rootObj[parentDataPath] as unknown[]) : null) || [];
      if (!Array.isArray(targetArr) || targetArr.length === 0) {
        for (const key of Object.keys(rootObj)) {
          if (Array.isArray(rootObj[key]) && (rootObj[key] as unknown[]).length > 0) {
            targetArr = rootObj[key] as unknown[];
            break;
          }
        }
      }
      const backLinkClass = tpl.bidirectionalLinkClass || linkClass.value;

      if (Array.isArray(targetArr)) {
        const rawMyId = String(props.entityId || '').replace(/^[^:]+:/, '');
        matched = (targetArr.find((it) => {
          if (!it || typeof it !== 'object') return false;
          const rec = it as Record<string, unknown>;
          const val = rec[backLinkClass] || (linkClass.value ? rec[linkClass.value] : undefined);
          const cleanVal = String(val || '').replace(/^[^:]+:/, '');
          return cleanVal === rawMyId || val === props.entityId || val === rawMyId || String(val).endsWith(`:${rawMyId}`);
        }) as Record<string, unknown>) || null;
      }

      if (!matched) {
        matched = {
          [backLinkClass]: props.entityId,
          _autoCreatedMirror: true
        };
        tpl.fields?.forEach((f) => {
          if (f.class && f.class !== backLinkClass) {
            matched![f.class] = f.type === 'number' ? 0 : '';
          }
        });
      }

      // Ensure dynamic container arrays exist
      if (tpl.dynamicContainers) {
        tpl.dynamicContainers.forEach((sub) => {
          const subPath = sub.dataPath || sub.id || sub.template;
          if (subPath && matched && matched[subPath] === undefined) {
            matched[subPath] = [];
          }
        });
        if (matched && matched['динамика_отношений'] !== undefined && matched['relationshipStates'] !== undefined) {
          delete matched['relationshipStates'];
        }
      }

      const deepCopied = JSON.parse(JSON.stringify(matched)) as Record<string, unknown>;
      foreignItem.value = deepCopied;
    } catch (err: unknown) {
      console.warn('[useRelationshipBlock] Failed to load foreign item:', err);
      foreignError.value = 'Ошибка загрузки: ' + String(err);
      foreignItem.value = null;
    } finally {
      foreignLoading.value = false;
    }
  };

  const fetchForeignItem = async (): Promise<void> => {
    const targetId = getTargetForeignId();
    if (!targetId) {
      foreignItem.value = null;
      return;
    }
    await loadForeignItem(targetId);
  };

  watch(
    () => getTargetForeignId(),
    (newTargetId) => {
      if (newTargetId) {
        loadForeignItem(newTargetId);
      } else {
        foreignItem.value = null;
      }
    },
    { immediate: true }
  );

  const onLinkChange = (fieldClass: string) => async (e: Event): Promise<void> => {
    const val = (e.target as HTMLInputElement | HTMLSelectElement).value;
    props.item[fieldClass] = val;
    emit('modified');
    await loadForeignItem(val);
  };

  const getOptions = (field: TemplateField) => {
    if (field?.options && field.options.length > 0) return field.options;
    const type = field?.entityType || (props.templateConf.foreign_type as string | undefined);
    if (type) {
      if (props.referenceData[`${type}_list`]) return props.referenceData[`${type}_list`];
      if (props.referenceData[type]) return props.referenceData[type];
    }
    return [];
  };

  const getNestedList = (sourceItem?: Record<string, unknown> | null, subConf?: SubConf): Array<Record<string, unknown>> => {
    const item = sourceItem || props.item;
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0] || props.templateConf;
    const path = targetSubConf?.dataPath || targetSubConf?.id || 'custom_dynamics';
    if (!path) return [];
    if (!item[path] || !Array.isArray(item[path])) {
      item[path] = [];
    }
    return item[path] as Array<Record<string, unknown>>;
  };

  const addNestedItem = (sourceItem?: Record<string, unknown> | null | Event, subConf?: SubConf) => {
    const isEvent = Boolean(sourceItem && (sourceItem instanceof Event || (typeof sourceItem === 'object' && 'type' in sourceItem && 'target' in sourceItem)));
    const item = (!isEvent && sourceItem && typeof sourceItem === 'object') ? (sourceItem as Record<string, unknown>) : props.item;
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0] || props.templateConf;
    const path = targetSubConf?.dataPath || targetSubConf?.id || 'custom_dynamics';
    if (!path) return;
    if (!item[path] || !Array.isArray(item[path])) {
      item[path] = [];
    }
    const existingList = item[path] as Array<Record<string, unknown>>;
    const lastItem = existingList && existingList.length > 0 ? existingList[existingList.length - 1] : null;

    const newItem: Record<string, unknown> = {};
    const fields = getResolvedFields(targetSubConf);
    fields.forEach((f) => {
      if (f.class) {
        newItem[f.class] = f.value !== undefined ? f.value : (f.type === 'number' ? 0 : '');
      }
    });

    // Наследование хронологии: старт нового этапа равен финишу предыдущего
    if (lastItem && lastItem['конечная_глава']) {
      const prevEnd = typeof lastItem['конечная_глава'] === 'object' && lastItem['конечная_глава'] !== null
        ? JSON.parse(JSON.stringify(lastItem['конечная_глава']))
        : { chapter_id: String(lastItem['конечная_глава']) };

      // Старт нового блока начинается в точке финиша предыдущего (но не имеет автопродления)
      newItem['начальная_глава'] = { ...prevEnd, is_auto_extend: false };

      // Финиш нового блока копирует ту же точку и перехватывает автопродление
      const hadAutoExtend = Boolean(prevEnd.is_auto_extend);
      newItem['конечная_глава'] = { ...prevEnd, is_auto_extend: hadAutoExtend };

      // У предыдущего этапа автопродление завершается
      if (typeof lastItem['конечная_глава'] === 'object' && lastItem['конечная_глава'] !== null) {
        (lastItem['конечная_глава'] as Record<string, unknown>).is_auto_extend = false;
      }
    }

    (item[path] as Array<Record<string, unknown>>).push(newItem);
    if (sourceItem && foreignItem.value) {
      foreignItem.value = { ...foreignItem.value };
    } else {
      emit('item-updated', { item: props.item, idx: props.idx });
    }
    emit('modified');
  };

  const removeNestedItem = (idx: number, sourceItem?: Record<string, unknown> | null, subConf?: SubConf) => {
    const item = sourceItem || props.item;
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0] || props.templateConf;
    const path = targetSubConf?.dataPath || targetSubConf?.id || 'custom_dynamics';
    if (!path) return;
    if (!item[path]) return;
    (item[path] as Array<Record<string, unknown>>).splice(idx, 1);
    if (sourceItem && foreignItem.value) {
      foreignItem.value = { ...foreignItem.value };
    } else {
      emit('item-updated', { item: props.item, idx: props.idx });
    }
    emit('modified');
  };

  const updateItemField = (fieldClass: string, val: unknown) => {
    props.item[fieldClass] = val;
    emit('modified');
    emit('item-updated', { item: props.item, idx: props.idx });
    if (fieldClass === linkClass.value) {
      if (val) {
        loadForeignItem(val);
      } else {
        foreignItem.value = null;
      }
    }
  };

  const onSelectChange = (fieldClass: string, val: unknown) => {
    updateItemField(fieldClass, val);
  };

  const makeSelectHandler = (index: number, subConf?: SubConf) => {
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0];
    const path = targetSubConf?.dataPath || targetSubConf?.id || 'custom_dynamics';
    return (e: Event) => {
      const list = props.item[path] as Array<Record<string, unknown>> | undefined;
      if (list && list[index]) {
        const val = (e.target as HTMLSelectElement | HTMLInputElement)?.value;
        const linkField = getResolvedFields(targetSubConf).find(f => f.type === 'select')?.class || 'foreign_id';
        list[index][linkField] = val;
        emit('item-updated', { item: props.item, idx: props.idx });
        emit('modified');
      }
    };
  };

  const notifyNestedItemUpdate = (_path?: string) => {
    emit('item-updated', { item: props.item, idx: props.idx });
    emit('modified');
  };

  const updateForeignField = (fieldClass: string, val: unknown) => {
    if (foreignItem.value) {
      foreignItem.value[fieldClass] = val;
      foreignItem.value = { ...foreignItem.value };
      emit('modified');
    }
  };

  const updateForeignNestedField = (nestedItem: Record<string, unknown>, fieldClass: string, val: unknown) => {
    nestedItem[fieldClass] = val;
    if (foreignItem.value) {
      foreignItem.value = { ...foreignItem.value };
    }
    emit('modified');
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
    fetchForeignItem,
    onLinkChange,
    loadForeignItem,
    getOptions,
    getResolvedFields,
    getNestedList,
    addNestedItem,
    removeNestedItem,
    getDynamicContainerFields,
    updateItemField,
    updateForeignField,
    updateForeignNestedField,
    onSelectChange,
    makeSelectHandler,
    notifyNestedItemUpdate
  };
}
