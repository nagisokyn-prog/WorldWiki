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
      try {
        if (open) {
          url.value = '';
          caption.value = '';
          align.value = 'block';
        }
      } catch (error) {
        console.error('[ImageInsertDialog] watch failed:', error);
        throw error;
      }
    },
  );

  const pickFile = () => {
    try {
      if (!fileInput.value) {
        console.error('[ImageInsertDialog] pickFile: fileInput ref is null');
        return;
      }
      fileInput.value.click();
    } catch (error) {
      console.error('[ImageInsertDialog] pickFile failed:', error);
      throw error;
    }
  };

  const onFileChange = (event: Event) => {
    try {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) {
        console.error('[ImageInsertDialog] onFileChange: no file selected');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        url.value = String(reader.result);
      };
      reader.onerror = () => {
        console.error('[ImageInsertDialog] onFileChange: FileReader error', reader.error);
      };
      reader.readAsDataURL(file);
      input.value = '';
    } catch (error) {
      console.error('[ImageInsertDialog] onFileChange failed:', error);
      throw error;
    }
  };

  const handleInsert = () => {
    try {
      if (!url.value.trim()) {
        console.error('[ImageInsertDialog] handleInsert: url is empty');
        return;
      }
      emit('insert', { src: url.value.trim(), caption: caption.value.trim(), align: align.value });
      emit('close');
    } catch (error) {
      console.error('[ImageInsertDialog] handleInsert failed:', error);
      throw error;
    }
  };

  return { url, caption, align, fileInput, pickFile, onFileChange, handleInsert };
}
