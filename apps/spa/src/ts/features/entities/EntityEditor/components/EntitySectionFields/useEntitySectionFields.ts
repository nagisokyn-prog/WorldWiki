import type { ManuscriptPoint, DatePickerModelValue } from '@/shared/ui';
import type { EntitySectionFieldsProps, EntitySectionFieldsEmits } from './EntitySectionFields.model';
import type { SchemaField } from '../../EntityEditor.model';

export function useEntitySectionFields(
  props: EntitySectionFieldsProps,
  emit: EntitySectionFieldsEmits
) {
  const getFieldKey = (field: SchemaField): string => field.path || field.id || field.class || '';

  const getFieldValue = (field: SchemaField): string => String(props.getProp(getFieldKey(field)) ?? '');

  const getManuscriptPointValue = (field: SchemaField): ManuscriptPoint | string | null | undefined => {
    return props.getProp(getFieldKey(field)) as ManuscriptPoint | string | null | undefined;
  };

  const getDatePickerValue = (field: SchemaField): string | DatePickerModelValue | null | undefined => {
    return props.getProp(getFieldKey(field)) as string | DatePickerModelValue | null | undefined;
  };

  const getTagsValue = (field: SchemaField): string | string[] | undefined => {
    return props.getProp(getFieldKey(field)) as string | string[] | undefined;
  };

  const isMultiselectChecked = (field: SchemaField, optValue: string): boolean => {
    const val = props.getProp(getFieldKey(field));
    return Array.isArray(val) && val.includes(optValue);
  };

  const setPhotoInput = (key: string, el: unknown) => {
    if (el) {
      const registry = props.photoInputs;
      registry[key] = el as HTMLInputElement;
    }
  };

  const handleTextareaInput = (key: string, event: Event) => {
    const val = (event.target as HTMLTextAreaElement).value;
    props.setProp(key, val);
    emit('modified');
  };

  const handleTextInput = (key: string, event: Event) => {
    const val = (event.target as HTMLInputElement).value;
    props.setProp(key, val);
    emit('modified');
  };

  const handleMultiselectEvent = (key: string, optValue: string, event: Event) => {
    const target = event.target as HTMLInputElement;
    let arr = (props.getProp(key) as string[]) || [];
    if (!Array.isArray(arr)) arr = [];
    if (target.checked && !arr.includes(optValue)) {
      arr = [...arr, optValue];
    } else if (!target.checked) {
      arr = arr.filter((v: string) => v !== optValue);
    }
    props.setProp(key, arr);
    emit('modified');
  };

  const handleFieldUpdate = (key: string, val: unknown) => {
    props.setProp(key, val);
    emit('modified');
  };

  const isFieldOngoing = (field: SchemaField): boolean => {
    const val = props.getProp(getFieldKey(field));
    if (val === null || val === undefined) return true;
    if (typeof val === 'object' && val !== null) {
      if ('ongoing' in val) return Boolean((val as Record<string, unknown>).ongoing);
      if ('m_abs' in val || 'год' in val || 'calendar_id' in val) return false;
      return false;
    }
    return false;
  };

  const toggleFieldOngoing = (field: SchemaField, event: Event) => {
    const target = event.target as HTMLInputElement;
    const key = getFieldKey(field);
    if (target.checked) {
      props.setProp(key, null);
    } else {
      props.setProp(key, { ongoing: false });
    }
    emit('modified');
  };

  return {
    getFieldKey,
    getFieldValue,
    getManuscriptPointValue,
    getDatePickerValue,
    getTagsValue,
    isMultiselectChecked,
    setPhotoInput,
    handleTextareaInput,
    handleTextInput,
    handleMultiselectEvent,
    handleFieldUpdate,
    isFieldOngoing,
    toggleFieldOngoing,
  };
}

