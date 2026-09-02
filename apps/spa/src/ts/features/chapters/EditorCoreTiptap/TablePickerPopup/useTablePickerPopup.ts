import { computed, ref } from 'vue';

export const MAX_ROWS = 8;
export const MAX_COLS = 10;

export interface TablePickerPopupProps {
  isOpen: boolean;
}

export interface TableInsertPayload {
  rows: number;
  cols: number;
}

export interface TablePickerEmit {
  (e: 'close'): void;
  (e: 'insert', payload: TableInsertPayload): void;
}

export function useTablePickerPopup(
  _props: TablePickerPopupProps,
  emit: TablePickerEmit,
) {
  const hover = ref<{ rows: number; cols: number } | null>(null);

  const rows = computed(() => Array.from({ length: MAX_ROWS }, (_, i) => i + 1));
  const cols = computed(() => Array.from({ length: MAX_COLS }, (_, i) => i + 1));

  const label = computed(() => {
    if (!hover.value) return 'Таблица';
    return `Таблица ${hover.value.rows}×${hover.value.cols}`;
  });

  const insert = (r: number, c: number) => {
    try {
      if (r < 1 || c < 1) {
        console.error('[TablePickerPopup] insert: invalid dimensions', { r, c });
        return;
      }
      emit('insert', { rows: r, cols: c });
      emit('close');
    } catch (error) {
      console.error('[TablePickerPopup] insert failed:', error);
      throw error;
    }
  };

  return { hover, rows, cols, label, insert };
}
