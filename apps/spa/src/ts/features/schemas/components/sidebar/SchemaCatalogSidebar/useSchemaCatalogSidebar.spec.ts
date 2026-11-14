import { describe, it, expect, vi } from 'vitest';
import { useSchemaCatalogSidebar } from './useSchemaCatalogSidebar';
import type { SchemaCatalogSidebarProps, SchemaCatalogSidebarEmits } from './SchemaCatalogSidebar.model';

describe('useSchemaCatalogSidebar', () => {
  it('emits start-resize and drag-start-palette events', () => {
    const emit = vi.fn() as unknown as SchemaCatalogSidebarEmits;
    const sidebar = useSchemaCatalogSidebar({} as SchemaCatalogSidebarProps, emit);

    const mouseEv = { clientX: 100 } as MouseEvent;
    const dragEv = { dataTransfer: null } as DragEvent;

    sidebar.onStartResize(mouseEv);
    sidebar.onDragStartPalette(dragEv, 'atomic', 'text', 'Текст');

    expect(emit).toHaveBeenNthCalledWith(1, 'start-resize', mouseEv);
    expect(emit).toHaveBeenNthCalledWith(2, 'drag-start-palette', dragEv, 'atomic', 'text', 'Текст');
  });
});

