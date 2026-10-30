export interface TablePickerInsertPayload {
  rows: number;
  cols: number;
}

export interface TablePickerPopupProps {
  isOpen: boolean;
}

export type TablePickerPopupEmits = {
  (e: 'close'): void;
  (e: 'insert', payload: TablePickerInsertPayload): void;
};

