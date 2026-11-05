import type { SchemaFieldDef, ModuleExample } from '@/features/schemas/types/schemaReference.types'

export interface ModuleHelpDynamicCardProps {
  example: ModuleExample;
    isChapterField: (field: SchemaFieldDef) => boolean;
    isEntityOrChapterSelect: (field: SchemaFieldDef) => boolean;
    getSelectOptions: (field: SchemaFieldDef) => Array<{ value: string; label: string }>;
}

export type ModuleHelpDynamicCardEmits = {};
