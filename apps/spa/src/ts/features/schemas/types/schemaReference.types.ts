export interface SchemaFieldDef {
  class?: string;
  id?: string;
  label?: string;
  type?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  entityType?: string;
  rows?: number;
  hint?: string;
  hidden?: boolean;
  [key: string]: unknown;
}

export interface SubContainerDef {
  id?: string;
  title?: string;
  template?: string;
  fields?: SchemaFieldDef[];
  emptyMessage?: string;
}

export interface ModuleExample {
  id: string;
  entityName: string;
  entityIcon: string;
  sectionTitle: string;
  containerTitle: string;
  isBidirectional: boolean;
  templateType: string;
  fields: SchemaFieldDef[];
  dynamicContainers?: SubContainerDef[];
}

export interface ModuleUsageInfo {
  templateKey: string;
  examples: ModuleExample[];
}

export interface RawTemplateDef {
  type?: string;
  isBidirectional?: boolean;
  headerTitle?: string;
  fields?: SchemaFieldDef[];
  dynamicContainers?: SubContainerDef[];
  bidirectionalLinkClass?: string;
  [key: string]: unknown;
}

export interface RawSchema {
  name?: string;
  iconEmoji?: string;
  icon?: string;
  entityType?: string;
  sections?: Array<{
    id?: string;
    title?: string;
    icon?: string;
    fields?: SchemaFieldDef[];
    dynamicContainers?: Array<{
      id?: string;
      type?: string;
      title?: string;
      template?: string;
      fields?: SchemaFieldDef[];
      fieldOverrides?: Record<string, SchemaFieldDef>;
      isBidirectional?: boolean;
      dynamicContainers?: SubContainerDef[];
      [key: string]: unknown;
    }>;
  }>;
  templates?: Record<string, RawTemplateDef>;
}
