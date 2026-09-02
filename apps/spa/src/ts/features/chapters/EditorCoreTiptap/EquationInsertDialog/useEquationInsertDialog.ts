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

/**
 * Логика диалога вставки уравнения.
 * КАЖДЫЙ обработчик при ошибке бросает — никаких тихих no-op.
 */
export function useEquationInsertDialog(
  props: EquationInsertDialogProps,
  emit: EquationInsertEmit,
) {
  const DEFAULT = 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx';
  const latex = ref(DEFAULT);

  watch(
    () => props.isOpen,
    (open) => {
      try {
        if (open) latex.value = DEFAULT;
      } catch (error) {
        console.error('[EquationInsertDialog] watch failed:', error);
        throw error;
      }
    },
  );

  const handleInsert = () => {
    try {
      if (!latex.value.trim()) {
        console.error('[EquationInsertDialog] handleInsert: latex is empty');
        return;
      }
      emit('insert', { latex: latex.value.trim() });
      emit('close');
    } catch (error) {
      console.error('[EquationInsertDialog] handleInsert failed:', error);
      throw error;
    }
  };

  return { latex, handleInsert };
}
