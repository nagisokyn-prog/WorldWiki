export interface AiSkillItem {
  id: string;
  project_id?: string;
  name: string;
  description: string;
  prompt_text: string;
  triggers?: string[];
  is_auto_trigger?: boolean;
  priority?: number;
  is_builtin?: boolean;
  is_unlocked?: boolean;
  is_custom_author_style?: boolean;
  file_path?: string;
  created_at?: string;
}

export interface SkillMatchResult {
  skill: AiSkillItem;
  matchedTrigger: string;
  score: number;
}

export interface SkillTriggerOptions {
  maxSkills?: number;
  excludeManual?: boolean;
}
