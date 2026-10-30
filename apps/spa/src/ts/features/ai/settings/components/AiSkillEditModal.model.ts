import type { AiSkillItem } from '../../skills/aiSkills.model'

export interface AiSkillEditModalProps {
  isEditing: boolean;
    editingSkill: Partial<AiSkillItem>;
    newTriggerInput: string;
}

export type AiSkillEditModalEmits = {
  (e: 'update:newTriggerInput', value: string): void;
    (e: 'update-field', field: keyof AiSkillItem, value: unknown): void;
    (e: 'close'): void;
    (e: 'add-trigger'): void;
    (e: 'remove-trigger', trig: string): void;
    (e: 'save'): void;
};
