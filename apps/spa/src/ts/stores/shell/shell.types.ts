/**
 * @file shell.types.ts
 * @description Общие типы для стора шелла и его подсистем
 */

export interface SidebarItem {
  type: 'static' | 'entity' | 'chapters';
  url?: string;
  entityType?: string;
  icon: string;
  emoji: string;
  title: string;
}

export interface ConsoleLog {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

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
  _foreignUpdates?: Record<string, unknown>;
}

export interface EditorGroup {
  id: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  flexBasis: number;
}

export interface QuickOpenItem {
  id: string;
  rawId: string;
  title: string;
  typeLabel: string;
  entityType: string;
  emoji: string;
  data: Record<string, unknown>;
}
