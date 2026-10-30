export interface SchemaEditorToolbarProps {
  localEntityType: string;
    isHistoryPreviewMode: boolean;
}

export type SchemaEditorToolbarEmits = {
  (e: 'update:localEntityType', value: string): void;
    (e: 'exit-preview'): void;
    (e: 'reset-changes'): void;
    (e: 'open-preview'): void;
    (e: 'open-json'): void;
    (e: 'save'): void;
    (e: 'toggle-history'): void;
};
