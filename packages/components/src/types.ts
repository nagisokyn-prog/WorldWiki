/**
 * @file types.ts
 * @description Types для деревьев и компонентов
 */

export interface TreeNodeData {
  id: string;
  label: string;
  icon?: string;
  emoji?: string;
  isGroup?: boolean;
  canAdd?: boolean;
  addLabel?: string;
  children?: TreeNodeData[];
  data?: any;
}

export interface TreeSectionData {
  id: string;
  title: string;
  icon?: string;
  canAdd?: boolean;
  canAddInline?: boolean;
  itemLabel?: string;
  nodes: TreeNodeData[];
}