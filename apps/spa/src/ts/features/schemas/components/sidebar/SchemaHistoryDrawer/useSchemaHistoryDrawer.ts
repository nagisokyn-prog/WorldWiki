import type { SchemaHistoryDrawerProps, SchemaHistoryDrawerEmits } from './SchemaHistoryDrawer.model';
import type { SchemaHistoryRecord } from '@/features/schemas/composables/useSchemaHistory';

export function useSchemaHistoryDrawer(
  _props: SchemaHistoryDrawerProps,
  emit: SchemaHistoryDrawerEmits
) {
  const onClose = () => emit('close');
  const onUpdateMaxSaves = (val: number) => emit('update:maxSaves', val);
  const onPreview = (item: SchemaHistoryRecord) => emit('preview', item);
  const onTogglePin = (item: SchemaHistoryRecord) => emit('toggle-pin', item);

  return {
    onClose,
    onUpdateMaxSaves,
    onPreview,
    onTogglePin,
  };
}

