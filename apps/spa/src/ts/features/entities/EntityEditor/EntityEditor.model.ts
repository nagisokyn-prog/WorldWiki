export interface SchemaField {
  id: string;
  class?: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'photo' | 'calendar_date' | 'calendar_date_base' | 'tags' | 'range' | string;
  path?: string;
  required?: boolean;
  hidden?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  entityType?: string;
  isSystem?: boolean;
  preventDelete?: boolean;
  preventHide?: boolean;
  [key: string]: unknown;
}

export interface DynamicContainer {
  id: string;
  title?: string;
  dataPath?: string;
  hidden?: boolean;
  template?: string;
  fieldOverrides?: Record<string, Record<string, unknown>>;
  customChildContainers?: DynamicContainer[];
  emptyMessage?: string;
  isBidirectional?: boolean;
  foreign_type?: string;
  fields?: SchemaField[];
  [key: string]: unknown;
}

export interface SchemaSection {
  id: string;
  title: string;
  icon?: string;
  hidden?: boolean;
  fields?: SchemaField[];
  dynamicContainers?: DynamicContainer[];
  [key: string]: unknown;
}

export interface SchemaConfig {
  sections: SchemaSection[];
  templates?: Record<string, { fields?: SchemaField[]; dynamicContainers?: DynamicContainer[]; foreign_type?: string; [key: string]: unknown }>;
  titleField?: string;
  [key: string]: unknown;
}

export interface EntityRevision {
  id: string;
  created_at: string;
  content: unknown;
  formattedDate?: string;
  is_pinned?: boolean;
}

export interface EntityEditorProps {
  entityId: string;
  entityType: string;
  project: string;
  initialData?: Record<string, unknown>;
  initialSection?: string;
  initialScrollPos?: number;
}

export interface EntityHistoryBannerProps {
  isPreviewing: boolean;
  isSandbox: boolean;
  formattedDate?: string;
}

export type EntityHistoryBannerEmits = {
  (e: 'restore'): void;
  (e: 'exit'): void;
};