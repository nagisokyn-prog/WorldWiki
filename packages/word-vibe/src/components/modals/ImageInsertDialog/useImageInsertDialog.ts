import { ref, watch } from 'vue';

export interface ImageInsertDialogProps {
  isOpen: boolean;
}

export interface ImageInsertPayload {
  src: string;
  caption: string;
  align: 'block' | 'left' | 'right';
}

export interface ImageInsertEmit {
  (e: 'close'): void;
  (e: 'insert', payload: ImageInsertPayload): void;
}

export function useImageInsertDialog(
  props: ImageInsertDialogProps,
  emit: ImageInsertEmit,
) {
  const url = ref('');
  const caption = ref('');
  const align = ref<'block' | 'left' | 'right'>('block');
  const fileInput = ref<HTMLInputElement | null>(null);

  watch(
    () => props.isOpen,
    (open) => {
      if (open) {
        url.value = '';
        caption.value = '';
        align.value = 'block';
      }
    },
  );

  const pickFile = () => {
    if (!fileInput.value) return;
    fileInput.value.click();
  };

  const onFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      url.value = String(reader.result);
    };
    reader.readAsDataURL(file);
    input.value = '';
  };

  const handleInsert = () => {
    if (!url.value.trim()) return;
    emit('insert', { src: url.value.trim(), caption: caption.value.trim(), align: align.value });
    emit('close');
  };

  return { url, caption, align, fileInput, pickFile, onFileChange, handleInsert };
}
