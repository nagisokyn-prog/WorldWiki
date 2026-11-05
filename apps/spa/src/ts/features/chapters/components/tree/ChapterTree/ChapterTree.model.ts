export interface ChapterTreeProps {
  project: string;
  activeNode?: Record<string, unknown> | null;
  activeEditorId?: string | null;
}

export interface ChapterTreeNode {
  id: string;
  label: string;
  emoji?: string;
  isGroup?: boolean;
  canAdd?: boolean;
  addLabel?: string;
  data?: Record<string, unknown>;
  children?: ChapterTreeNode[];
}