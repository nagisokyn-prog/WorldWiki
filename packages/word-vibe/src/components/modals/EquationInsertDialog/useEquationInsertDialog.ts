import { ref, watch } from 'vue';

export interface EquationInsertDialogProps {
  isOpen: boolean;
}

export interface EquationInsertPayload {
  latex: string;
}

export interface EquationInsertEmit {
  (e: 'close'): void;
  (e: 'insert', payload: EquationInsertPayload): void;
}

export function useEquationInsertDialog(
  props: EquationInsertDialogProps,
  emit: EquationInsertEmit,
) {
  const DEFAULT = 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx';
  const latex = ref(DEFAULT);

  watch(
    () => props.isOpen,
    (open) => {
      if (open) latex.value = DEFAULT;
    },
  );

  const handleInsert = () => {
    if (!latex.value.trim()) return;
    emit('insert', { latex: latex.value.trim() });
    emit('close');
  };

  return { latex, handleInsert };
}
