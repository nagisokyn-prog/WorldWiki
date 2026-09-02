import { ref, watch } from 'vue';

export interface LinkInsertDialogProps {
  isOpen: boolean;
}

export interface LinkInsertPayload {
  url: string;
  text: string;
}

export interface LinkInsertEmit {
  (e: 'close'): void;
  (e: 'insert', payload: LinkInsertPayload): void;
}

export function useLinkInsertDialog(
  props: LinkInsertDialogProps,
  emit: LinkInsertEmit,
) {
  const url = ref('https://');
  const text = ref('');

  watch(
    () => props.isOpen,
    (open) => {
      try {
        if (open) {
          url.value = 'https://';
          text.value = '';
        }
      } catch (error) {
        console.error('[LinkInsertDialog] watch failed:', error);
        throw error;
      }
    },
  );

  const handleInsert = () => {
    try {
      if (!url.value.trim()) {
        console.error('[LinkInsertDialog] handleInsert: url is empty');
        return;
      }
      emit('insert', { url: url.value.trim(), text: text.value.trim() });
      emit('close');
    } catch (error) {
      console.error('[LinkInsertDialog] handleInsert failed:', error);
      throw error;
    }
  };

  return { url, text, handleInsert };
}
