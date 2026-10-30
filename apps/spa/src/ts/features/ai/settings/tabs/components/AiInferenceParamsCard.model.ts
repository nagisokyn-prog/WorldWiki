import type { AiProfileSettings } from '../../../types/ai.types'

export interface AiInferenceParamsCardProps {
  localSettings: AiProfileSettings;
}

export type AiInferenceParamsCardEmits = {
  (e: 'update-setting', key: keyof AiProfileSettings, val: unknown): void;
};
