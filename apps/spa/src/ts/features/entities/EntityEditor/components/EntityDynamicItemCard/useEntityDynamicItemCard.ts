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

  const isFieldOngoing = (fieldKey: string): boolean => {
    const val = props.getProp(props.item, fieldKey);
    if (val === null || val === undefined) return true;
    if (typeof val === 'object' && val !== null) {
      if ('ongoing' in val) return Boolean((val as Record<string, unknown>).ongoing);
      if ('m_abs' in val || 'год' in val || 'calendar_id' in val) return false;
      return false;
    }
    return false;
  };

  const toggleFieldOngoing = (fieldKey: string, e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      updateProp(fieldKey, null);
    } else {
      updateProp(fieldKey, { ongoing: false });
    }
  };

  const hiddenFields = computed<string[]>(() => {
    const raw = props.item._hiddenFields || props.item.__hidden_fields;
    return Array.isArray(raw) ? (raw as string[]) : [];
  });

  const isFieldHidden = (fieldKey: string): boolean => {
    return hiddenFields.value.includes(fieldKey);
  };

  const canHideField = (field: SchemaField): boolean => {
    const cls = (field.class || field.id || field.path || '').toLowerCase();
    if (cls.includes('глава') || cls.includes('дата') || cls.includes('время') || cls.includes('manuscript')) {
      return true;
    }
    if (field.preventHide || field.required) return false;
    return true;
  };

  const hideField = (fieldKey: string) => {
    const list = [...hiddenFields.value];
    if (!list.includes(fieldKey)) {
      list.push(fieldKey);
      updateProp('_hiddenFields', list);
    }
  };

  const unhideField = (fieldKey: string) => {
    const list = hiddenFields.value.filter(k => k !== fieldKey);
    updateProp('_hiddenFields', list);
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
    isFieldOngoing,
    toggleFieldOngoing,
    isFieldHidden,
    canHideField,
    hideField,
    unhideField,
  };
}
