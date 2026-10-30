export interface PromiseCardNoteProps {
  editingNoteId: string | null;
    itemId?: string | null;
    note?: string | null;
    noteDraft: string;
}

export type PromiseCardNoteEmits = {
  (e: 'update:noteDraft', val: string): void;
    (e: 'startEdit'): void;
    (e: 'cancelEdit'): void;
    (e: 'save'): void;
};
