export interface EditorTab {
  id: string;
  rawId: string;
  title: string;
  entityType: string;
  tabType: 'entity' | 'chapter' | 'schema-editor';
  data: Record<string, unknown>;
  unsaved: boolean;
  scrollPos?: number;
  activeSection?: string;
}

export interface EditorGroup {
  id: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  flexBasis: number;
}

export interface EditorGroupPaneProps {
  group: EditorGroup;
  isActive: boolean;
  canClose: boolean;
  isSandbox?: boolean;
}

export type EditorGroupPaneEmits = {
  (e: 'focus'): void;
  (e: 'activate-tab', groupId: string, tabId: string): void;
  (e: 'close-tab', groupId: string, tabId: string): void;
  (e: 'split', groupId: string): void;
  (e: 'close-group', groupId: string): void;
  (e: 'move-tab', payload: { tabId: string; toGroupId: string; toIndex: number }): void;
  (e: 'reorder-tab', payload: { groupId: string; fromIdx: number; toIdx: number }): void;
};
