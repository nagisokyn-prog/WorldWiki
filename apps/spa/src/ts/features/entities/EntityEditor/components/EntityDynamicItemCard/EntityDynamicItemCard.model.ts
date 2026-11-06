import type { DynamicContainer, SchemaField } from '../../EntityEditor.model';

export interface EntityDynamicItemCardProps {
  item: Record<string, unknown>;
  idx: number;
  container: DynamicContainer;
  project: string;
  wheelHorizontal?: boolean;
  isItemCollapsed: (path: string, idx: number) => boolean;
  getItemSummary: (item: Record<string, unknown>, container: DynamicContainer) => string;
  getResolvedTemplate: (container: DynamicContainer) => DynamicContainer | null;
  getProp: (obj: unknown, path: string) => unknown;
  setProp: (obj: unknown, path: string, val: unknown) => void;
  getOptionsFor: (field: SchemaField) => Array<{ value: string; label: string }>;
  isChapterField: (field: SchemaField) => boolean;
}

export type EntityDynamicItemCardEmits = {
  (e: 'toggleCollapse', path: string, idx: number): void;
  (e: 'remove', path: string, idx: number): void;
  (e: 'modified'): void;
};
