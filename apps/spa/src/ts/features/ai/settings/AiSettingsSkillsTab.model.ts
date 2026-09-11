import type { AiSkillItem } from '../skills/aiSkills.model';

export type { AiSkillItem };

export interface AiSettingsSkillsTabProps {
  currentProject: string;
}

export interface AiSettingsSkillsTabEmits {
  (e: 'skills-updated'): void;
}
