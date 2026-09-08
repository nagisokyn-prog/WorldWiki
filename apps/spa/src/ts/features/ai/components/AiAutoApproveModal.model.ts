export interface ToolApprovalCategories {
  read: boolean;
  write: boolean;
  delete: boolean;
  timeline: boolean;
  audit: boolean;
  delegate: boolean;
}

export interface ToolCategoryInfo {
  key: keyof ToolApprovalCategories;
  label: string;
  icon: string;
  description: string;
}

export const ALL_TOOL_CATEGORIES: ToolCategoryInfo[] = [
  { key: 'read', label: 'Чтение', icon: 'fas fa-eye', description: 'Чтение лора, сущностей и текста глав (world_query, entity_inspect, manuscript_read)' },
  { key: 'write', label: 'Запись', icon: 'fas fa-pen', description: 'Создание/изменение сущностей и редактирование текста (entity_manage, manuscript_edit)' },
  { key: 'delete', label: 'Удаление', icon: 'fas fa-trash-alt', description: 'Удаление сущностей из базы данных (entity_manage: delete)' },
  { key: 'timeline', label: 'Хронология', icon: 'fas fa-clock', description: 'Календарь, конвертация дат и временная шкала (timeline_manage)' },
  { key: 'audit', label: 'Аудит', icon: 'fas fa-search', description: 'Поиск сюжетных несогласованностей и чеховских ружей (consistency_audit)' },
  { key: 'delegate', label: 'Делегирование', icon: 'fas fa-tasks', description: 'Запуск изолированных фоновых агентов для глубоких расследований (task_delegate)' }
];

export const MODE_CATEGORIES_MAP: Record<string, (keyof ToolApprovalCategories)[]> = {
  companion: ['read', 'timeline'],
  chat: ['read', 'timeline'],
  editor: ['read', 'write', 'delete', 'timeline'],
  edit: ['read', 'write', 'delete', 'timeline'],
  analyst: ['read', 'timeline', 'audit', 'delegate'],
  analyze: ['read', 'timeline', 'audit', 'delegate']
};

export interface AutoApproveState {
  enabled: boolean;
  categories: ToolApprovalCategories;
}

export interface AiAutoApproveModalProps {
  currentProject: string;
  placement?: 'top' | 'bottom';
  activeModeSlug?: string;
}

export interface AiAutoApproveModalEmits {
  (e: 'update:state', state: AutoApproveState): void;
}

