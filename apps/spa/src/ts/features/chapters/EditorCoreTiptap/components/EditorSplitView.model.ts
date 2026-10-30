export interface EditorSplitViewProps {
  markdownContent: string;
    editor?: Editor;
    leftPanelWidth: number;
    rightPanelWidth: number;
    showStructure: boolean;
    selectedBlockIdx: number | null;
    documentStructure: Array<{ type: string; text: string; semanticTag?: string; pIndex?: number }>;
}

export type EditorSplitViewEmits = {
  (e: 'update:markdownContent', val: string): void;
    (e: 'input', event: Event): void;
    (e: 'keydown', event: KeyboardEvent): void;
    (e: 'contextmenu', event: MouseEvent): void;
    (e: 'open-entity-selector'): void;
    (e: 'start-resize-left', event: MouseEvent): void;
    (e: 'start-resize-right', event: MouseEvent): void;
    (e: 'scroll-to-block', idx: number): void;
    (e: 'cycle-tag', pIndex: number): void;
};
