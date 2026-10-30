/**
 * @file CreateEntityModal.model.ts
 * @description Модели данных для модального окна создания новой сущности
 */

export interface EntityTypeOption {
  type: string;
  name: string;
  icon?: string;
  description?: string;
}

export interface CreateEntityModalProps {
  isOpen: boolean;
  projectName: string;
  initialEntityType?: string | null;
  initialName?: string;
}

export interface CreateEntityModalEmits {
  (e: 'close'): void;
  (e: 'create', payload: { entityType: string; name: string }): void;
}

