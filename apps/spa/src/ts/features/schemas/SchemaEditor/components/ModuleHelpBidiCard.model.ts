import type { SchemaFieldDef, ModuleExample } from '../schemaReference.types'

export interface ModuleHelpBidiCardProps {
  example: ModuleExample;
    isChapterField: (field: SchemaFieldDef) => boolean;
    isEntityOrChapterSelect: (field: SchemaFieldDef) => boolean;
    getSelectOptions: (field: SchemaFieldDef) => Array<{ value: string; label: string }>;
}

export type ModuleHelpBidiCardEmits = {};
