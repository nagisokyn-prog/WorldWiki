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
      if (open) {
        url.value = 'https://';
        text.value = '';
      }
    },
  );

  const handleInsert = () => {
    if (!url.value.trim()) return;
    emit('insert', { url: url.value.trim(), text: text.value.trim() });
    emit('close');
  };

  return { url, text, handleInsert };
}
