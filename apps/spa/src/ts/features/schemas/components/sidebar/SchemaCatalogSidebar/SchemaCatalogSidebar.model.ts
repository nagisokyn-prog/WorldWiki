import type { SchemaTemplateItem } from '@/features/schemas/composables/useSchemaTemplates'

export interface SchemaCatalogSidebarProps {
  catalogWidth: number;
    atomicBricks: Array<{ val: string; label: string; icon: string }>;
    timelineTemplates: Record<string, SchemaTemplateItem>;
    dynamicTemplates: Record<string, SchemaTemplateItem>;
}

export type SchemaCatalogSidebarEmits = {
  (e: 'start-resize', ev: MouseEvent): void;
    (e: 'drag-start-palette', ev: DragEvent, type: 'atomic' | 'module', val: string, label: string): void;
};
