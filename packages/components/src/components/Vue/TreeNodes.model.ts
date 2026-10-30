import type { TreeNodeData } from './ExplorerTree.vue';

export interface TreeNodesProps {
  nodes: TreeNodeData[];
  expanded: Set<string>;
  activeId?: string;
  selectedIds: Set<string>;
  renamingId?: string;
  renamingValue?: string;
}

export type TreeNodesEmits = {
  (e: 'toggle-expand', id: string): void;
  (e: 'click-node', ev: MouseEvent, node: TreeNodeData): void;
  (e: 'dblclick-node', node: TreeNodeData): void;
  (e: 'ctx-node', ev: MouseEvent, node: TreeNodeData): void;
  (e: 'create-in', node: TreeNodeData): void;
  (e: 'update:renaming-value', value: string): void;
  (e: 'commit-rename'): void;
  (e: 'cancel-rename'): void;
  (e: 'drag-start', ev: DragEvent, node: TreeNodeData): void;
  (e: 'drag-enter', ev: DragEvent, node: TreeNodeData): void;
  (e: 'drag-over', ev: DragEvent, node: TreeNodeData): void;
  (e: 'drag-leave', ev: DragEvent, node: TreeNodeData): void;
  (e: 'drop-node', ev: DragEvent, node: TreeNodeData): void;
};
