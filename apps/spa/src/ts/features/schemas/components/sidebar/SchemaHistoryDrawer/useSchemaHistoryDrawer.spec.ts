import { describe, it, expect, vi } from 'vitest';
import { useSchemaHistoryDrawer } from './useSchemaHistoryDrawer';
import type { SchemaHistoryDrawerProps, SchemaHistoryDrawerEmits } from './SchemaHistoryDrawer.model';
import type { SchemaHistoryRecord } from '@/features/schemas/composables/useSchemaHistory';

describe('useSchemaHistoryDrawer', () => {
  it('emits drawer actions', () => {
    const emit = vi.fn() as unknown as SchemaHistoryDrawerEmits;
    const drawer = useSchemaHistoryDrawer({} as SchemaHistoryDrawerProps, emit);
    const item = { id: 'h-1' } as unknown as SchemaHistoryRecord;

    drawer.onClose();
    drawer.onUpdateMaxSaves(20);
    drawer.onPreview(item);
    drawer.onTogglePin(item);

    expect(emit).toHaveBeenNthCalledWith(1, 'close');
    expect(emit).toHaveBeenNthCalledWith(2, 'update:maxSaves', 20);
    expect(emit).toHaveBeenNthCalledWith(3, 'preview', item);
    expect(emit).toHaveBeenNthCalledWith(4, 'toggle-pin', item);
  });
});

