import { ref } from 'vue';
import * as api from '@/services/api.client';

export function useEntityPhoto(setProp: (path: string, val: unknown) => void) {
  const photoInputs = ref<Record<string, HTMLInputElement>>({});

  const uploadPhoto = async (file: File) => {
    try {
      const path = await api.uploadPhoto(Array.from(new Uint8Array(await file.arrayBuffer())), file.name);
      return path;
    } catch (e) {
      console.error('Photo upload failed:', e);
      throw e;
    }
  };

  const triggerPhotoUpload = (fieldClass: string) => {
    if (photoInputs.value[fieldClass]) {
      photoInputs.value[fieldClass].click();
    }
  };

  const handlePhotoFile = async (event: Event, fieldClass: string) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      try {
        const path = await uploadPhoto(file);
        setProp(fieldClass, path);
      } catch {
        const { appAlert } = await import('@worldwiki/components');
        appAlert('Ошибка загрузки фото');
      }
    }
  };

  const handlePhotoDrop = async (event: DragEvent, fieldClass: string) => {
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const path = await uploadPhoto(file);
        setProp(fieldClass, path);
      } catch {
        const { appAlert } = await import('@worldwiki/components');
        appAlert('Ошибка загрузки фото');
      }
    }
  };

  const removePhoto = (fieldClass: string) => {
    setProp(fieldClass, '');
  };

  return {
    photoInputs,
    triggerPhotoUpload,
    handlePhotoFile,
    handlePhotoDrop,
    removePhoto
  };
}
