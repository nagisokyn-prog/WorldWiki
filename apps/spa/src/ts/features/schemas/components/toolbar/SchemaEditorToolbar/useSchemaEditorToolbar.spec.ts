import { describe, it, expect, vi } from 'vitest';
import { useSchemaEditorToolbar } from './useSchemaEditorToolbar';
import type { SchemaEditorToolbarProps, SchemaEditorToolbarEmits } from './SchemaEditorToolbar.model';

describe('useSchemaEditorToolbar', () => {
  it('emits all toolbar actions', () => {
    const emit = vi.fn() as unknown as SchemaEditorToolbarEmits;
    const toolbar = useSchemaEditorToolbar({} as SchemaEditorToolbarProps, emit);

    toolbar.onInputEntityType('character');
    toolbar.onExitPreview();
    toolbar.onResetChanges();
    toolbar.onOpenPreview();
    toolbar.onOpenJson();
    toolbar.onSave();
    toolbar.onToggleHistory();

    expect(emit).toHaveBeenNthCalledWith(1, 'update:localEntityType', 'character');
    expect(emit).toHaveBeenNthCalledWith(2, 'exit-preview');
    expect(emit).toHaveBeenNthCalledWith(3, 'reset-changes');
    expect(emit).toHaveBeenNthCalledWith(4, 'open-preview');
    expect(emit).toHaveBeenNthCalledWith(5, 'open-json');
    expect(emit).toHaveBeenNthCalledWith(6, 'save');
    expect(emit).toHaveBeenNthCalledWith(7, 'toggle-history');
  });
});

