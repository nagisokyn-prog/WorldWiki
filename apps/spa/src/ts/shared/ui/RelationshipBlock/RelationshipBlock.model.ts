export interface TemplateField {
  class: string;
  label?: string;
  type?: string;
  value?: unknown;
  placeholder?: string;
  entityType?: string;
  options?: Array<{ value: string; label: string }>;
  [key: string]: unknown;
}

export interface SubConf {
  id?: string;
  template?: string;
  title?: string;
  emptyMessage?: string;
  fields?: TemplateField[];
  fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }>;
  dataPath?: string;
  [key: string]: unknown;
}

export interface TemplateConf {
  headerTitle?: string;
  template?: string;
  bidirectionalLinkClass?: string;
  fields?: TemplateField[];
  dynamicContainers?: SubConf[];
  foreign_type?: string;
  fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }>;
  dataPath?: string;
  id?: string;
  isBidirectional?: boolean;
  [key: string]: unknown;
}

export interface RelationshipBlockProps {
  templateConf: TemplateConf;
  allTemplates: Record<string, { fields?: TemplateField[]; [key: string]: unknown }>;
  referenceData: Record<string, Array<{ value: unknown; label: string; id?: unknown; name?: unknown; [key: string]: unknown }>>;
  item: Record<string, unknown>;
  idx?: number;
  entityType: string;
  entityId: string;
  project: string;
  sandboxMode?: boolean;
}
