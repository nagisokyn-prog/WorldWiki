export interface EquationInsertDialogProps {
  isOpen: boolean;
}

export type EquationInsertDialogEmits = {
  (e: 'close'): void;
  (e: 'insert', payload: { latex: string }): void;
};

