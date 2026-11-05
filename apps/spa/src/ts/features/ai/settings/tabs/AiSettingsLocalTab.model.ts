import type { AiProfile, AiProfileSettings } from '@/features/ai/types/ai.types'

export interface AiSettingsLocalTabProps {
  activeProfile: AiProfile | null;
}

export type AiSettingsLocalTabEmits = {
  (e: 'save-profile', payload: { settings: AiProfileSettings }): void;
};
