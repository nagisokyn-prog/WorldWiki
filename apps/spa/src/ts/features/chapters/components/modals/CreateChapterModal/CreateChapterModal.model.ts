/**
 * @file CreateChapterModal.model.ts
 * @description Типы данных и интерфейсы для модального окна создания новой главы
 */

export interface VolumeOption {
  id: string | null;
  title: string;
}

export interface CreateChapterModalProps {
  isOpen: boolean;
  projectName: string;
  initialVolumeId?: string | null;
  initialTitle?: string;
}

export interface CreateChapterModalEmits {
  (e: 'close'): void;
  (e: 'create', payload: { title: string; volumeId: string | null }): void;
}

