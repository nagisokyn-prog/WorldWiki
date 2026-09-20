import type { AiSkillItem } from '../../tools/AiSkillAutocomplete/AiSkillAutocomplete.model';

export interface AiChatInputProps {
  loading?: boolean;
  skills?: AiSkillItem[];
}

export interface AiChatInputEmits {
  (e: 'submit', text: string): void;
  (e: 'cancel'): void;
}
