export interface ChapterTreeProps {
  project: string;
  activeNode?: Record<string, any> | null;
  activeEditorId?: string;
}

export interface ChapterTreeNode {
  id: string;
  label: string;
  emoji?: string;
  isGroup?: boolean;
  canAdd?: boolean;
  addLabel?: string;
  data?: Record<string, any>;
  children?: ChapterTreeNode[];
}