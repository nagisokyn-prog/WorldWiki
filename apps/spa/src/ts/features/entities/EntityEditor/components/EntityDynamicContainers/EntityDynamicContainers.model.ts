import type { DynamicContainer, SchemaConfig, SchemaField } from '../../EntityEditor.model';

export interface EntityDynamicContainersProps {
  containers: DynamicContainer[];
  config?: SchemaConfig | null;
  project: string;
  entityId: string;
  entityType: string;
  referenceData?: Record<string, Array<{ value: string; label: string }>>;
  wheelHorizontal?: boolean;
  isContainerHidden: (id: string) => boolean;
  isFieldChanged: (path: string) => boolean;
  canHideContainer: (c: DynamicContainer) => boolean;
  getDynamicList: (c: DynamicContainer) => Array<Record<string, unknown>>;
  areAllCollapsed: (path: string, total: number) => boolean;
  getResolvedTemplate: (c: DynamicContainer) => DynamicContainer | null;
  getItemSummary: (item: Record<string, unknown>, c: DynamicContainer) => string;
  getProp: (obj: unknown, path: string) => unknown;
  setProp: (obj: unknown, path: string, val: unknown) => void;
  getOptionsFor: (field: SchemaField) => Array<{ value: string; label: string }>;
  isChapterField: (field: SchemaField) => boolean;
  isItemCollapsed: (path: string, idx: number) => boolean;
}

export type EntityDynamicContainersEmits = {
  (e: 'toggleAllCollapse', path: string, count: number): void;
  (e: 'hideContainer', path: string): void;
  (e: 'addDynamicItem', path: string, template: string): void;
  (e: 'removeDynamicItem', path: string, idx: number): void;
  (e: 'toggleItemCollapse', path: string, idx: number): void;
  (e: 'modified'): void;
  (e: 'foreignUpdate', payload: Record<string, unknown>): void;
};

