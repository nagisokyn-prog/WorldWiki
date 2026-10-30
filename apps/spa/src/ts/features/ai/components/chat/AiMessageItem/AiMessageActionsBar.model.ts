export interface AiMessageActionsBarProps {
  role: 'user' | 'assistant' | 'system';
}

export type AiMessageActionsBarEmits = {
  (e: 'copy'): void;
    (e: 'start-edit'): void;
    (e: 'regenerate'): void;
    (e: 'branch'): void;
    (e: 'delete'): void;
};
