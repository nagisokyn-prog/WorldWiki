import type { ModuleHelpBidiCardProps } from './ModuleHelpBidiCard.model';
import type { SchemaFieldDef } from '@/features/schemas/types/schemaReference.types';

export function useModuleHelpBidiCard(props: ModuleHelpBidiCardProps) {
  const isChapterField = (field: SchemaFieldDef) => props.isChapterField(field);
  const isEntityOrChapterSelect = (field: SchemaFieldDef) => props.isEntityOrChapterSelect(field);
  const getSelectOptions = (field: SchemaFieldDef) => props.getSelectOptions(field);

  return {
    isChapterField,
    isEntityOrChapterSelect,
    getSelectOptions,
  };
}

