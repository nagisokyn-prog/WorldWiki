import type { Ref, ComputedRef } from 'vue';
import type { SubConf, TemplateField, RelationshipBlockProps } from './RelationshipBlock.model';

export function useRelationshipNestedOps(
  props: RelationshipBlockProps,
  emit: (event: string, ...args: unknown[]) => void,
  linkClass: ComputedRef<string>,
  getResolvedFields: (subConf?: SubConf | { template?: string; fields?: TemplateField[]; fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }> }) => TemplateField[],
  foreignItem: Ref<Record<string, unknown> | null>,
  loadForeignItem: (targetId: unknown) => Promise<void>
) {
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

    if (lastItem && lastItem['конечная_дата']) {
      newItem['начальная_дата'] = typeof lastItem['конечная_дата'] === 'object' && lastItem['конечная_дата'] !== null
        ? JSON.parse(JSON.stringify(lastItem['конечная_дата']))
        : lastItem['конечная_дата'];
      newItem['конечная_дата'] = null;
    }

    (item[path] as Array<Record<string, unknown>>).push(newItem);
    if (sourceItem && foreignItem.value && sourceItem === foreignItem.value) {
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
    if (sourceItem && foreignItem.value && sourceItem === foreignItem.value) {
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

  const onLinkChange = (fieldClass: string) => async (e: Event): Promise<void> => {
    const val = (e.target as HTMLInputElement | HTMLSelectElement).value;
    props.item[fieldClass] = val;
    emit('modified');
    await loadForeignItem(val);
  };

  const makeSelectHandler = (index: number, subConf?: SubConf) => {
    const targetSubConf = subConf || props.templateConf.dynamicContainers?.[0];
    return (e: Event) => {
      const path = targetSubConf?.dataPath || targetSubConf?.id || 'custom_dynamics';
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

  return {
    getNestedList,
    addNestedItem,
    removeNestedItem,
    updateItemField,
    onSelectChange,
    onLinkChange,
    makeSelectHandler,
    notifyNestedItemUpdate
  };
}
