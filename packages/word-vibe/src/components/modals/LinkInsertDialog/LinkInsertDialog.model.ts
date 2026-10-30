export interface LinkInsertPayload {
  url: string;
  text: string;
}

export interface LinkInsertDialogProps {
  isOpen: boolean;
}

export type LinkInsertDialogEmits = {
  (e: 'close'): void;
  (e: 'insert', payload: LinkInsertPayload): void;
};

