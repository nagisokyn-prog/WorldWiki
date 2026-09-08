import type { AiSkillItem } from './AiSkillAutocomplete.model';

export interface AiChatInputProps {
  loading?: boolean;
  skills?: AiSkillItem[];
}

export interface AiChatInputEmits {
  (e: 'submit', text: string): void;
  (e: 'cancel'): void;
}
