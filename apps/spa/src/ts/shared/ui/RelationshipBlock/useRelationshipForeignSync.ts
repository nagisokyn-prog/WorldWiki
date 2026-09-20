import { ref, computed, watch, type ComputedRef } from 'vue';
import { invoke, processIds } from '@worldwiki/components';
import type { RelationshipBlockProps } from './RelationshipBlock.model';

export function useRelationshipForeignSync(
  props: RelationshipBlockProps,
  emit: (event: string, ...args: unknown[]) => void,
  linkClass: ComputedRef<string>,
  getTargetForeignId: () => unknown
) {
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
      const detail = await invoke<Record<string, unknown>>('get_entity', { id: String(targetId) });
      const targetData = processIds(detail);
      if (!targetData) {
        throw new Error(`Entity ${targetId} not found or returned null`);
      }

      const parentDataPath = tpl.dataPath || tpl.id || tpl.template;
      let matched: Record<string, unknown> | null = null;

      const rootObj = (targetData.data && typeof targetData.data === 'object') ? (targetData.data as Record<string, unknown>) : targetData;
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
    foreignItem,
    foreignLoading,
    foreignError,
    foreignModified,
    myLabel,
    foreignLabel,
    loadForeignItem,
    fetchForeignItem,
    updateForeignField,
    updateForeignNestedField
  };
}
