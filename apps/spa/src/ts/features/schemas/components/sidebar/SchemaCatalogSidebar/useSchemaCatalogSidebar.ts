import type { SchemaCatalogSidebarProps, SchemaCatalogSidebarEmits } from './SchemaCatalogSidebar.model';

export function useSchemaCatalogSidebar(
  _props: SchemaCatalogSidebarProps,
  emit: SchemaCatalogSidebarEmits
) {
  const onStartResize = (ev: MouseEvent) => {
    emit('start-resize', ev);
  };

  const onDragStartPalette = (
    ev: DragEvent,
    type: 'atomic' | 'module',
    val: string,
    label: string
  ) => {
    emit('drag-start-palette', ev, type, val, label);
  };

  return {
    onStartResize,
    onDragStartPalette,
  };
}

