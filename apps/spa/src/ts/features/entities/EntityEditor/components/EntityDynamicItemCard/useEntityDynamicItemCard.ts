import { computed } from 'vue';
import type { EntityDynamicItemCardProps, EntityDynamicItemCardEmits } from './EntityDynamicItemCard.model';
import type { SchemaField } from '../../EntityEditor.model';

export function useEntityDynamicItemCard(
  props: EntityDynamicItemCardProps,
  emit: EntityDynamicItemCardEmits
) {
  const containerPath = computed(() => props.container.dataPath || props.container.id || '');

  const isCollapsed = computed(() => props.isItemCollapsed(containerPath.value, props.idx));

  const itemSummary = computed(() => props.getItemSummary(props.item, props.container));

  const templateFields = computed<SchemaField[]>(() => props.getResolvedTemplate(props.container)?.fields || []);

  const toggleCollapse = () => {
    emit('toggleCollapse', containerPath.value, props.idx);
  };

  const remove = () => {
    emit('remove', containerPath.value, props.idx);
  };

  const updateProp = (fieldKey: string, value: unknown) => {
    props.setProp(props.item, fieldKey, value);
    emit('modified');
  };

  const onMultiselectToggle = (fieldKey: string, optValue: string, checked: boolean) => {
    const current = [...((props.getProp(props.item, fieldKey) as unknown[]) || [])];
    if (checked) {
      current.push(optValue);
    } else {
      const idx = current.indexOf(optValue);
      if (idx > -1) current.splice(idx, 1);
    }
    updateProp(fieldKey, current);
  };

  const getFieldValue = (fieldKey: string): string => {
    return String(props.getProp(props.item, fieldKey) ?? '');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getFieldProp = (fieldKey: string): any => {
    return props.getProp(props.item, fieldKey);
  };

  const isMultiselectChecked = (fieldKey: string, optValue: string): boolean => {
    const val = props.getProp(props.item, fieldKey);
    return Array.isArray(val) && val.includes(optValue);
  };

  const onTextareaInput = (fieldKey: string, e: Event) => {
    updateProp(fieldKey, (e.target as HTMLTextAreaElement).value);
  };

  const onTextInput = (fieldKey: string, e: Event) => {
    updateProp(fieldKey, (e.target as HTMLInputElement).value);
  };

  const onNumberInput = (fieldKey: string, e: Event) => {
    updateProp(fieldKey, Number((e.target as HTMLInputElement).value));
  };

  const onCheckboxChange = (fieldKey: string, optValue: string, e: Event) => {
    onMultiselectToggle(fieldKey, optValue, (e.target as HTMLInputElement).checked);
  };

  return {
    containerPath,
    isCollapsed,
    itemSummary,
    templateFields,
    toggleCollapse,
    remove,
    updateProp,
    onMultiselectToggle,
    getFieldValue,
    getFieldProp,
    isMultiselectChecked,
    onTextareaInput,
    onTextInput,
    onNumberInput,
    onCheckboxChange,
  };
}
