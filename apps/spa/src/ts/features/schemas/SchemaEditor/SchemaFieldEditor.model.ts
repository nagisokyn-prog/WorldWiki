import type { SchemaFieldItem } from './useSchemaFieldEditor';

export interface SchemaFieldEditorProps {
  item: SchemaFieldItem;
    isFirst: boolean;
}

export type SchemaFieldEditorEmits = {
  remove: [];
};
