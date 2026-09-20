import type { AiSkillItem } from '../../../skills/aiSkills.model';

export type { AiSkillItem };

export interface AiSkillAutocompleteProps {
  isOpen: boolean;
  searchQuery: string;
  skills: AiSkillItem[];
}

export interface AiSkillAutocompleteEmits {
  (e: 'select', skill: AiSkillItem): void;
  (e: 'close'): void;
}
