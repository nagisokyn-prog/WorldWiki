import type { SchemaEditorToolbarProps, SchemaEditorToolbarEmits } from './SchemaEditorToolbar.model';

export function useSchemaEditorToolbar(
  _props: SchemaEditorToolbarProps,
  emit: SchemaEditorToolbarEmits
) {
  const onInputEntityType = (value: string) => emit('update:localEntityType', value);
  const onExitPreview = () => emit('exit-preview');
  const onResetChanges = () => emit('reset-changes');
  const onOpenPreview = () => emit('open-preview');
  const onOpenJson = () => emit('open-json');
  const onSave = () => emit('save');
  const onToggleHistory = () => emit('toggle-history');

  return {
    onInputEntityType,
    onExitPreview,
    onResetChanges,
    onOpenPreview,
    onOpenJson,
    onSave,
    onToggleHistory,
  };
}

