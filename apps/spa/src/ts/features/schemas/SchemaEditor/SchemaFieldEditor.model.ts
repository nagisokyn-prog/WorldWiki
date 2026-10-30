import type { SchemaFieldItem } from './useSchemaFiledEditor'

export interface SchemaFieldEditorProps {
  item: SchemaFieldItem;
    isFirst: boolean;
}

export type SchemaFieldEditorEmits = {
  remove: [];
};
