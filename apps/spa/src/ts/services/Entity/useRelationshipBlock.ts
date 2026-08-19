import { ref, computed } from 'vue';
import { entityApi } from './entity.api';
import { settingsService } from '@worldwiki/components';

export interface TemplateField {
  class: string;
  label?: string;
  type?: string;
  value?: unknown;
  placeholder?: string;
  entityType?: string;
  options?: Array<{ value: string; label: string }>;
  [key: string]: unknown;
}

export interface SubConf {
  id?: string;
  template?: string;
  title?: string;
  emptyMessage?: string;
  fields?: TemplateField[];
  fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }>;
  dataPath?: string;
  [key: string]: unknown;
}

export interface TemplateConf {
  headerTitle?: string;
  template?: string;
  bidirectionalLinkClass?: string;
  fields?: TemplateField[];
  dynamicContainers?: SubConf[];
  foreign_type?: string;
  fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }>;
  dataPath?: string;
  id?: string;
  isBidirectional?: boolean;
  [key: string]: unknown;
}

export interface RelationshipBlockProps {
  templateConf: TemplateConf;
  allTemplates: Record<string, { fields?: TemplateField[]; [key: string]: unknown }>;
  referenceData: Record<string, Array<{ value: unknown; label: string; id?: unknown; name?: unknown; [key: string]: unknown }>>;
  item: Record<string, unknown>;
  entityType: string;
  entityId: string;
  project: string;
  sandboxMode?: boolean;
}

export function useRelationshipBlock(props: RelationshipBlockProps, emit: (event: string, ...args: unknown[]) => void) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

  const foreignItem = ref<Record<string, unknown> | null>(null);
  const foreignLoading = ref(false);
  const foreignError = ref('');
  const foreignModified = ref(false);

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
    }
    return 'character';
  });

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
    const rawId = props.entityId;
    const refList = props.referenceData[`${props.entityType}_list`] || props.referenceData[props.entityType];
    if (refList) {
      const found = refList.find((e) => e.value === rawId || String(e.id) === rawId);
      if (found) return found.label || (found.name as string) || String(found.value);
    }
    return props.entityId || 'Текущая сущность';
  });

  const foreignLabel = computed<string>(() => {
    const foreignId = props.item[linkClass.value];
    if (!foreignId) return 'Не выбрано';
    const targetType = props.templateConf.fields?.find((f) => f.class === linkClass.value)?.entityType || (props.templateConf.foreign_type as string | undefined);
    if (targetType) {
      const refList = props.referenceData[`${targetType}_list`] || props.referenceData[targetType];
      if (refList) {
        const found = refList.find((e) => e.value === foreignId || String(e.id) === String(foreignId));
        if (found) return found.label || (found.name as string) || String(found.value);
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
    const targetEntityType = linkField?.entityType || (tpl.foreign_type as string | undefined) || 'character';
    if (!targetEntityType) return;

    foreignLoading.value = true;
    foreignError.value = '';
    foreignModified.value = false;

    try {
      const targetData = await entityApi.getEntity(props.project, targetEntityType, String(targetId));
      if (!targetData) {
        throw new Error(`Entity ${targetId} not found or returned null`);
      }

      const parentDataPath = tpl.dataPath || tpl.id || tpl.template || 'characterRelationships';
      let matched: Record<string, unknown> | null = null;
      
      const rootObj = (targetData.data && typeof targetData.data === 'object') ? targetData.data as Record<string, unknown> : targetData;
      const targetArr = (parentDataPath ? (rootObj[parentDataPath] as unknown[]) : null) || [];
      const backLinkClass = tpl.bidirectionalLinkClass || linkClass.value;

      if (Array.isArray(targetArr)) {
        const rawMyId = props.entityId.replace(/^[^:]+:/, '');
        matched = (targetArr.find((it) => {
          if (!it || typeof it !== 'object') return false;
          const val = (it as Record<string, unknown>)[backLinkClass];
          return val === props.entityId || val === rawMyId || String(val).endsWith(`:${rawMyId}`);
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
    const targetId = props.item[linkClass.value];
    if (!targetId) {
      foreignItem.value = null;
      return;
    }
    await loadForeignItem(targetId);
  };

  const onLinkChange = (fieldClass: string) => async (e: Event): Promise<void> => {
    const val = (e.target as HTMLInputElement | HTMLSelectElement).value;
    props.item[fieldClass] = val;
    emit('modified');
    await loadForeignItem(val);
  };

  const getOptions = (field: TemplateField) => {
    if (field?.options) return field.options;
    const type = field?.entityType || (props.templateConf.foreign_type as string | undefined);
    if (type) {
      if (props.referenceData[`${type}_list`]) return props.referenceData[`${type}_list`];
      if (props.referenceData[type]) return props.referenceData[type];
    }
    return [];
  };

  const getNestedList = (sourceItem?: Record<string, unknown> | null, subConf?: SubConf): Array<Record<string, unknown>> => {
    const item = sourceItem || props.item;
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0];
    if (!targetSubConf) return [];
    const path = targetSubConf.dataPath || targetSubConf.id || 'custom_dynamics';
    if (!path) return [];
    if (!item[path]) item[path] = [];
    return item[path] as Array<Record<string, unknown>>;
  };

  const addNestedItem = (sourceItem?: Record<string, unknown> | null, subConf?: SubConf) => {
    const item = sourceItem || props.item;
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0];
    if (!targetSubConf) return;
    const path = targetSubConf.dataPath || targetSubConf.id || 'custom_dynamics';
    if (!path) return;
    if (!item[path]) item[path] = [];
    
    const newItem: Record<string, unknown> = {};
    const fields = getResolvedFields(targetSubConf);
    fields.forEach((f) => {
      if (f.class) {
        newItem[f.class] = f.value ?? (f.type === 'number' ? 0 : '');
      }
    });

    (item[path] as Array<Record<string, unknown>>).push(newItem);
    emit('item-updated');
    emit('modified');
  };

  const removeNestedItem = (idx: number, sourceItem?: Record<string, unknown> | null, subConf?: SubConf) => {
    const item = sourceItem || props.item;
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0];
    if (!targetSubConf) return;
    const path = targetSubConf.dataPath || targetSubConf.id || 'custom_dynamics';
    if (!path) return;
    if (!item[path]) return;
    (item[path] as Array<Record<string, unknown>>).splice(idx, 1);
    emit('item-updated');
    emit('modified');
  };

  const updateItemField = (fieldClass: string, val: unknown) => {
    props.item[fieldClass] = val;
    emit('modified');
    emit('item-updated');
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
        emit('item-updated');
        emit('modified');
      }
    };
  };

  const notifyNestedItemUpdate = (_path?: string) => {
    emit('item-updated');
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
    onSelectChange,
    makeSelectHandler,
    notifyNestedItemUpdate
  };
}
