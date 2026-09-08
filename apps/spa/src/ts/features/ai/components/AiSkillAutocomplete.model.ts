export interface AiSkillItem {
  id: string;
  name: string;
  description: string;
  prompt_text?: string;
  trigger?: string;
  content?: string;
  project_id?: string;
  is_unlocked?: boolean;
  is_custom_author_style?: boolean;
}

export interface AiSkillAutocompleteProps {
  isOpen: boolean;
  searchQuery: string;
  skills: AiSkillItem[];
}

export interface AiSkillAutocompleteEmits {
  (e: 'select', skill: AiSkillItem): void;
  (e: 'close'): void;
}
