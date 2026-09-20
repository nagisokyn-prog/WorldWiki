export interface SchemaField {
  id?: string;
  class?: string;
  label?: string;
  type?: string;
  placeholder?: string;
  rows?: number;
  min?: number;
  max?: number;
  hint?: string;
  entityType?: string;
  options?: Array<{ value: string; label: string }>;
  [key: string]: unknown;
}

export interface DynamicContainer {
  id: string;
  title: string;
  fields?: SchemaField[];
  [key: string]: unknown;
}

export interface ModuleHelpExample {
  id: string;
  entityName: string;
  entityIcon: string;
  sectionTitle: string;
  containerTitle: string;
  isBidirectional?: boolean;
  fields?: SchemaField[];
  dynamicContainers?: DynamicContainer[];
}
