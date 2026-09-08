export interface AiSkillItem {
  id: string;
  project_id?: string;
  name: string;
  description: string;
  prompt_text: string;
  is_unlocked?: boolean;
  is_custom_author_style?: boolean;
  created_at?: string;
}

export interface AiSettingsSkillsTabProps {
  currentProject: string;
}

export interface AiSettingsSkillsTabEmits {
  (e: 'skills-updated'): void;
}
