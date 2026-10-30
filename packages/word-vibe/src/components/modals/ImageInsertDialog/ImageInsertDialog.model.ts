export type ImageAlignment = 'block' | 'left' | 'right';

export interface ImageInsertPayload {
  src: string;
  caption: string;
  align: ImageAlignment;
}

export interface ImageInsertDialogProps {
  isOpen: boolean;
}

export type ImageInsertDialogEmits = {
  (e: 'close'): void;
  (e: 'insert', payload: ImageInsertPayload): void;
};

